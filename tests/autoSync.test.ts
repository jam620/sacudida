import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoSyncEnabled,
  getEarthquakesWithAutoSync,
  parseFilters,
  resetAutoSyncStateForTests,
} from "@/server/services/earthquakeService";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import {
  setSettingValue,
  getSettingValue,
} from "@/server/repositories/settingsRepository";
import { upsertEarthquakeRow } from "@/server/repositories/earthquakeRepository";
import { LAST_SYNC_SETTING_KEY } from "@/server/etl/usgsImporter";
import type { EarthquakeRow } from "@/types/earthquake";
import { jsonResponse, makeUsgsFeature, makeUsgsPayload } from "./fixtures/usgs";

const originalFetch = globalThis.fetch;

function recentRow(id: string): EarthquakeRow {
  const now = Date.now();
  return {
    id,
    magnitude: 3.1,
    place: "Cerca de Panamá",
    longitude: -80.5,
    latitude: 8.5,
    depth_km: 12,
    occurred_at_utc: new Date(now - 3_600_000).toISOString(),
    updated_at_utc: new Date(now - 3_600_000).toISOString(),
    source: "us",
    external_url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: new Date(now - 3_600_000).toISOString(),
    raw_json: "{}",
  };
}

/** Activa la sincronización automática (setup.ts la desactiva y fuerza NODE_ENV=test). */
function enableAutoSync(): void {
  process.env.DISABLE_AUTO_SYNC = "0";
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
}

function disableAutoSync(): void {
  process.env.DISABLE_AUTO_SYNC = "1";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
  resetAutoSyncStateForTests();
  disableAutoSync();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  disableAutoSync();
});

describe("autoSyncEnabled", () => {
  it("respeta DISABLE_AUTO_SYNC y NODE_ENV", () => {
    expect(autoSyncEnabled()).toBe(false);

    process.env.DISABLE_AUTO_SYNC = "0";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(autoSyncEnabled()).toBe(true);

    process.env.DISABLE_AUTO_SYNC = "1";
    expect(autoSyncEnabled()).toBe(false);
  });
});

describe("getEarthquakesWithAutoSync", () => {
  it("no llama a USGS cuando la caché está fresca (ventana de 4 s)", async () => {
    upsertEarthquakeRow(recentRow("ya-hay-datos"));
    setSettingValue(LAST_SYNC_SETTING_KEY, new Date().toISOString());

    const fetchSpy = vi.fn(async () => {
      throw new Error("no debía llamarse a USGS");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    enableAutoSync();

    const result = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ya-hay-datos");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-sincroniza cuando los datos están vencidos", async () => {
    upsertEarthquakeRow(recentRow("dato-viejo"));
    setSettingValue(
      LAST_SYNC_SETTING_KEY,
      new Date(Date.now() - 5 * 60_000).toISOString()
    );

    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([
          makeUsgsFeature({ id: "dato-viejo", mag: 3.1 }),
          makeUsgsFeature({ id: "replica-nueva", mag: 4.4 }),
        ])
      )
    );
    enableAutoSync();

    const result = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(result.map((earthquake) => earthquake.id)).toContain(
      "replica-nueva"
    );
    expect(getSettingValue(LAST_SYNC_SETTING_KEY)).not.toBeNull();
  });

  it("sincroniza con el piso y límite de importación definidos", async () => {
    let requestedUrl = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return jsonResponse(makeUsgsPayload([]));
    });
    enableAutoSync();

    await getEarthquakesWithAutoSync(parseFilters({}));

    expect(requestedUrl).toContain("minmagnitude=2");
    expect(requestedUrl).toContain("limit=500");
  });

  it("con la sincronización desactivada devuelve la lista vacía sin fetch", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(makeUsgsPayload([])));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sincroniza en frío cuando la base está vacía y sirve los datos", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(makeUsgsPayload([makeUsgsFeature({ id: "frio-uno", mag: 4.2 })]))
    );
    enableAutoSync();

    const result = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(result.map((e) => e.id)).toContain("frio-uno");
  });

  it("fail-safe: si USGS falla, devuelve lo que haya sin romper", async () => {
    upsertEarthquakeRow(recentRow("ultimo-valido"));
    setSettingValue(
      LAST_SYNC_SETTING_KEY,
      new Date(Date.now() - 5 * 60_000).toISOString()
    );

    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    enableAutoSync();

    const result = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(result.map((e) => e.id)).toEqual(["ultimo-valido"]);
  });

  it("backoff: tras un fallo espera antes de volver a intentar", async () => {
    setSettingValue(
      LAST_SYNC_SETTING_KEY,
      new Date(Date.now() - 5 * 60_000).toISOString()
    );

    const fetchSpy = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    enableAutoSync();

    // Primer intento: falla y marca el backoff.
    await getEarthquakesWithAutoSync(parseFilters({}));

    // Segundo intento inmediato con USGS "recuperado": no debe llamar.
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(makeUsgsPayload([makeUsgsFeature({ id: "post-backoff" })]))
    );
    const second = await getEarthquakesWithAutoSync(parseFilters({}));

    expect(second).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("no sincroniza si la caché está fresca aunque los filtros no arrojen nada", async () => {
    upsertEarthquakeRow(recentRow("m4-reciente"));
    setSettingValue(LAST_SYNC_SETTING_KEY, new Date().toISOString());

    const fetchSpy = vi.fn(async () => jsonResponse(makeUsgsPayload([])));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    enableAutoSync();

    // Filtro M6: vacío con estos datos, pero la caché está fresca.
    const result = await getEarthquakesWithAutoSync(parseFilters({ minMagnitude: 6 }));

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
