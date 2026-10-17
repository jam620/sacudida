import { beforeEach, describe, expect, it } from "vitest";
import {
  CROSS_SOURCE_TIME_MS,
  findCrossSourceDuplicate,
  importIgcEarthquakes,
  normalizeIgcEvent,
} from "@/server/etl/igcImporter";
import { lastSyncStatusBySource } from "@/server/repositories/observabilityRepository";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { upsertEarthquakeRow } from "@/server/repositories/earthquakeRepository";
import { findEarthquakeById } from "@/server/repositories/earthquakeRepository";
import type { EarthquakeRow } from "@/types/earthquake";

const originalFetch = globalThis.fetch;

function usgsRow(overrides: Partial<EarthquakeRow> = {}): EarthquakeRow {
  const now = new Date().toISOString();
  return {
    id: "us7000abc",
    magnitude: 4.2,
    place: "Cerca de Tonosí",
    longitude: -80.4,
    latitude: 7.4,
    depth_km: 12,
    occurred_at_utc: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at_utc: now,
    source: "usgs",
    external_url: "https://earthquake.usgs.gov/",
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: now,
    raw_json: "{}",
    ...overrides,
  };
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM sync_log").run();
  delete process.env.IGC_UP_FEED_URL;
});

describe("normalizeIgcEvent", () => {
  it("normaliza un evento del feed al modelo interno (epoch ms)", () => {
    const row = normalizeIgcEvent({
      id: 9876,
      magnitud: 3.4,
      lugar: "4 km al sureste de Las Tablas",
      latitud: 7.38,
      longitud: -80.28,
      profundidadKm: 8,
      hora: Date.UTC(2026, 9, 13, 15, 30, 0),
    });

    expect(row.id).toBe("igc-9876");
    expect(row.source).toBe("igcup");
    expect(row.magnitude).toBe(3.4);
    expect(row.occurred_at_utc).toBe("2026-10-13T15:30:00.000Z");
    expect(row.external_url).toBe("https://x.com/igcpanamaup");
    expect(JSON.parse(row.raw_json ?? "{}").id).toBe(9876);
  });

  it("acepta hora ISO y URL propia del evento", () => {
    const row = normalizeIgcEvent({
      id: "bol-42",
      magnitud: 2.8,
      latitud: 7.9,
      longitud: -80.6,
      hora: "2026-10-14T18:00:00Z",
      url: "https://igc-up.example/bol-42",
    });
    expect(row.occurred_at_utc).toBe("2026-10-14T18:00:00.000Z");
    expect(row.external_url).toBe("https://igc-up.example/bol-42");
  });

  it("rechaza eventos con campos fuera de rango", () => {
    expect(() =>
      normalizeIgcEvent({ id: "x", magnitud: 3, latitud: 120, longitud: -80, hora: Date.now() })
    ).toThrow();
  });
});

describe("findCrossSourceDuplicate", () => {
  const base = {
    time: Date.UTC(2026, 9, 14, 12, 0, 0),
    latitude: 7.4,
    longitude: -80.4,
    magnitude: 4.2,
    source: "igcup",
  };

  it("detecta duplicado: misma hora, ~10 km, Δmag 0.3", () => {
    const usgs = { ...base, source: "usgs", time: base.time + 10_000, magnitude: 4.5, latitude: 7.45 };
    expect(findCrossSourceDuplicate(base, [usgs])).toBe(true);
  });

  it("no cruza fuentes iguales ni eventos lejanos en el tiempo", () => {
    expect(findCrossSourceDuplicate(base, [{ ...base, source: "igcup" }])).toBe(false);
    const late = {
      ...base,
      source: "usgs",
      time: base.time + CROSS_SOURCE_TIME_MS + 5_000,
    };
    expect(findCrossSourceDuplicate(base, [late])).toBe(false);
  });

  it("no duplica si difiere la magnitud o está fuera del radio", () => {
    const bigger = { ...base, source: "usgs", magnitude: base.magnitude + 1 };
    expect(findCrossSourceDuplicate(base, [bigger])).toBe(false);

    // 1° de latitud ≈ 111 km > 30 km de tolerancia.
    const far = { ...base, source: "usgs", latitude: base.latitude + 1 };
    expect(findCrossSourceDuplicate(base, [far])).toBe(false);
  });
});

describe("importIgcEarthquakes", () => {
  it("sin IGC_UP_FEED_URL queda en not-configured y lo registra", async () => {
    const result = await importIgcEarthquakes();
    expect(result.status).toBe("not-configured");
    expect(result.imported).toBe(0);
    expect(lastSyncStatusBySource().igcup?.status).toBe("not-configured");
  });

  it("con feed: importa, deduplica contra USGS y respeta la fuente", async () => {
    process.env.IGC_UP_FEED_URL = "https://igc-up.example/feed.json";
    const dupTime = Date.now() - 1_800_000;
    upsertEarthquakeRow(
      usgsRow({
        id: "us7000dup",
        occurred_at_utc: new Date(dupTime).toISOString(),
        latitude: 7.4,
        longitude: -80.4,
        magnitude: 4.0,
      })
    );

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          eventos: [
            {
              id: 111,
              magnitud: 3.8,
              lugar: "Cerca de Pedasí",
              latitud: 7.41,
              longitud: -80.39,
              profundidadKm: 6,
              hora: dupTime + 5_000,
            },
            {
              id: 222,
              magnitud: 2.6,
              lugar: "Soná",
              latitud: 7.99,
              longitud: -80.85,
              profundidadKm: 12,
              hora: Date.now() - 900_000,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as unknown as typeof fetch;

    try {
      const result = await importIgcEarthquakes();
      expect(result.status).toBe("ok");
      expect(result.imported).toBe(1);
      expect(result.duplicates).toBe(1);

      const saved = findEarthquakeById("igc-222");
      expect(saved?.source).toBe("igcup");
      expect(saved?.magnitude).toBe(2.6);
      // El duplicado del USGS no se guardó como evento nuevo.
      expect(findEarthquakeById("igc-111")).toBeNull();
      expect(lastSyncStatusBySource().igcup?.status).toBe("ok");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.IGC_UP_FEED_URL;
    }
  });

  it("feed caído: fail-safe, registra el error y no lanza", async () => {
    process.env.IGC_UP_FEED_URL = "https://igc-up.example/feed.json";
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    try {
      const result = await importIgcEarthquakes();
      expect(result.status).toBe("error");
      expect(lastSyncStatusBySource().igcup?.status).toBe("error");
      expect(lastSyncStatusBySource().igcup?.error).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.IGC_UP_FEED_URL;
    }
  });
});
