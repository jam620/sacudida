import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { findEarthquakeById } from "@/server/repositories/earthquakeRepository";
import { getSettingValue } from "@/server/repositories/settingsRepository";
import { importUsgsEarthquakes } from "@/server/etl/usgsImporter";
import { jsonResponse, makeUsgsFeature, makeUsgsPayload } from "./fixtures/usgs";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("importUsgsEarthquakes", () => {
  it("importa eventos válidos y registra la sincronización", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([
          makeUsgsFeature({ id: "us1000uno", mag: 3.4 }),
          makeUsgsFeature({ id: "us1000dos", mag: 5.1, tsunami: 1 }),
        ])
      )
    );

    const result = await importUsgsEarthquakes();

    expect(result).toMatchObject({ inserted: 2, updated: 0, skipped: 0, pruned: 0 });
    expect(result.insertedIds).toEqual(["us1000uno", "us1000dos"]);

    const one = findEarthquakeById("us1000uno");
    expect(one?.magnitude).toBe(3.4);

    const two = findEarthquakeById("us1000dos");
    expect(two?.tsunami).toBe(true);

    const lastSync = getSettingValue("lastSyncAt");
    expect(lastSync).not.toBeNull();
    expect(Number.isFinite(Date.parse(lastSync as string))).toBe(true);
  });

  it("es idempotente: reimportar el mismo lote no reescribe", async () => {
    // El payload se construye UNA vez: con fechas relativas a ahora,
    // regenerarlo en cada llamada del mock haría variar updated_at_utc
    // por milisegundos y rompería la idempotencia.
    const payload = makeUsgsPayload([makeUsgsFeature({ id: "us2000" })]);
    globalThis.fetch = vi.fn(async () => jsonResponse(payload));

    await importUsgsEarthquakes();
    const second = await importUsgsEarthquakes();

    expect(second).toMatchObject({ inserted: 0, updated: 0, skipped: 1, pruned: 0 });
    expect(second.insertedIds).toEqual([]);
  });

  it("actualiza eventos cuyo updated_at_utc cambió", async () => {
    const firstUpdated = Date.now() - 3 * 3_600_000;
    const secondUpdated = Date.now() - 1 * 3_600_000;

    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([
          makeUsgsFeature({ id: "us3000", mag: 4.0, updated: firstUpdated }),
        ])
      )
    );
    await importUsgsEarthquakes();

    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([
          makeUsgsFeature({ id: "us3000", mag: 4.6, updated: secondUpdated }),
        ])
      )
    );
    const second = await importUsgsEarthquakes();

    expect(second).toMatchObject({ inserted: 0, updated: 1, skipped: 0, pruned: 0 });
    expect(findEarthquakeById("us3000")?.magnitude).toBe(4.6);
  });

  it("descarta features inválidos sin detener la importación", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([
          { id: "roto-sin-geometria", properties: makeUsgsFeature().properties },
          makeUsgsFeature({ id: "us4000valido" }),
        ])
      )
    );

    const result = await importUsgsEarthquakes();

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(findEarthquakeById("us4000valido")).not.toBeNull();
  });

  it("poda eventos con más de 30 días durante la sincronización", async () => {
    const db = getDatabase();
    const oldDate = new Date(Date.now() - 40 * 24 * 3_600_000).toISOString();
    db.prepare(
      `INSERT INTO earthquakes (
         id, magnitude, place, longitude, latitude, depth_km,
         occurred_at_utc, updated_at_utc, source, external_url,
         tsunami_flag, review_status, created_at, raw_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "usantiguo",
      5,
      "Evento viejo",
      -80,
      8,
      10,
      oldDate,
      oldDate,
      "us",
      "https://earthquake.usgs.gov/earthquakes/eventpage/usantiguo",
      0,
      "reviewed",
      oldDate,
      "{}"
    );

    globalThis.fetch = vi.fn(async () =>
      jsonResponse(makeUsgsPayload([makeUsgsFeature({ id: "us5000" })]))
    );

    const result = await importUsgsEarthquakes();

    expect(result.pruned).toBe(1);
    expect(findEarthquakeById("usantiguo")).toBeNull();
    expect(findEarthquakeById("us5000")).not.toBeNull();
  });

  it("rechaza respuestas estructuralmente inválidas", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ count: 0 }));

    await expect(importUsgsEarthquakes()).rejects.toThrow(
      /Respuesta de USGS inválida/
    );
  });

  it("rechaza errores HTTP del proveedor con UpstreamError", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ features: [] }, 500));

    await expect(importUsgsEarthquakes()).rejects.toThrow(
      /USGS respondió con estado 500/
    );
  });

  it("traduce fallos de red a un error claro", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(importUsgsEarthquakes()).rejects.toThrow(
      /No fue posible conectar con USGS/
    );
  });
});
