import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/earthquakes/stats/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import {
  countAftershocksSince,
  findStrongestEarthquake,
  upsertEarthquakeRow,
} from "@/server/repositories/earthquakeRepository";
import {
  getAftershockSummary,
  MAINSHOCK_THRESHOLD,
} from "@/server/services/earthquakeService";
import type { AftershockStatsResponse } from "@/types/earthquake";
import { OFFICIAL_BALANCE } from "@/lib/officialBalance";
import { jsonResponse, makeUsgsFeature, makeUsgsPayload } from "./fixtures/usgs";

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function seedRow(id: string, magnitude: number, hoursAgo: number): void {
  upsertEarthquakeRow({
    id,
    magnitude,
    place: "Secuencia de prueba",
    longitude: -80.5,
    latitude: 8.0,
    depth_km: 10,
    occurred_at_utc: isoAgo(hoursAgo),
    updated_at_utc: isoAgo(hoursAgo),
    source: "us",
    external_url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: isoAgo(hoursAgo),
    raw_json: "{}",
  });
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

describe("findStrongestEarthquake", () => {
  it("devuelve el evento de mayor magnitud del periodo", () => {
    seedRow("sismo-a", 4.5, 10);
    seedRow("principal", 7.7, 26);
    seedRow("sismo-b", 5.0, 5);

    const strongest = findStrongestEarthquake({
      days: 30,
      minMagnitude: MAINSHOCK_THRESHOLD,
    });

    expect(strongest?.id).toBe("principal");
  });

  it("respeta la magnitud mínima y el periodo", () => {
    seedRow("moderado", 5.9, 3);
    seedRow("fuera-de-periodo", 8.1, 24 * 40);

    expect(
      findStrongestEarthquake({ days: 30, minMagnitude: MAINSHOCK_THRESHOLD })
    ).toBeNull();
  });
});

describe("countAftershocksSince", () => {
  it("cuenta total, última hora y últimas 24 h posteriores al principal", () => {
    const mainshockAt = isoAgo(26);
    seedRow("principal", 7.7, 26);
    seedRow("rep-old", 3.0, 25); // > 24 h
    seedRow("rep-24h", 3.2, 20); // dentro de 24 h
    seedRow("rep-24h-b", 4.0, 10);
    seedRow("rep-1h", 3.5, 0.5); // dentro de la última hora
    seedRow("pre-sismo", 4.2, 30); // anterior al principal: no cuenta

    const counts = countAftershocksSince(mainshockAt, { minMagnitude: 2.5 });

    expect(counts.total).toBe(4);
    expect(counts.last24h).toBe(3);
    expect(counts.lastHour).toBe(1);
  });

  it("aplica la magnitud mínima al conteo", () => {
    const mainshockAt = isoAgo(10);
    seedRow("principal", 7.7, 10);
    seedRow("rep-chica", 2.0, 5);
    seedRow("rep-media", 4.0, 4);

    const counts = countAftershocksSince(mainshockAt, { minMagnitude: 2.5 });

    expect(counts.total).toBe(1);
  });
});

describe("getAftershockSummary", () => {
  it("devuelve principal y conteos; null sin secuencia activa", () => {
    seedRow("principal", 7.7, 26);
    seedRow("rep-1", 4.0, 20);
    seedRow("rep-2", 3.2, 1);

    const summary = getAftershockSummary();
    expect(summary?.mainshock.id).toBe("principal");
    expect(summary?.aftershocks.total).toBe(2);

    // Sin terremoto grande: null y la UI se oculta.
    const db = getDatabase();
    db.prepare("DELETE FROM earthquakes").run();
    seedRow("solo-chicos", 5.4, 2);
    expect(getAftershockSummary()).toBeNull();
  });
});

describe("GET /api/earthquakes/stats", () => {
  it("responde el resumen de la secuencia activa", async () => {
    seedRow("principal", 7.7, 26);
    seedRow("rep-1", 4.6, 12);
    seedRow("rep-2", 4.1, 0.5);

    const response = await GET();
    const body = (await response.json()) as AftershockStatsResponse;

    expect(response.status).toBe(200);
    if (!body.ok) {
      expect.unreachable("la respuesta debía ser exitosa");
      return;
    }
    expect(body.mainshock?.id).toBe("principal");
    expect(body.aftershocks?.total).toBe(2);
    expect(body.aftershocks?.lastHour).toBe(1);
  });

  it("devuelve null cuando no hay secuencia activa", async () => {
    seedRow("tranquilo", 3.3, 2);

    const response = await GET();
    const body = (await response.json()) as AftershockStatsResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.mainshock).toBeNull();
      expect(body.aftershocks).toBeNull();
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }
  });

  it("puebla la caché en arranque en frío antes de calcular", async () => {
    const originalFetch = globalThis.fetch;
    process.env.DISABLE_AUTO_SYNC = "0";
    (process.env as Record<string, string | undefined>).NODE_ENV =
      "production";

    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        makeUsgsPayload([makeUsgsFeature({ id: "frio-principal", mag: 7.7 })])
      )
    );

    try {
      const response = await GET();
      const body = (await response.json()) as AftershockStatsResponse;

      expect(response.status).toBe(200);
      if (body.ok) {
        expect(body.mainshock?.id).toBe("frio-principal");
      }
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
      process.env.DISABLE_AUTO_SYNC = "1";
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    }
  });
});

describe("OFFICIAL_BALANCE (datos curados)", () => {
  it("mantiene el formato trazable: fecha válida, cifras con fuente https", () => {
    expect(Number.isFinite(Date.parse(OFFICIAL_BALANCE.updatedAtUtc))).toBe(
      true
    );
    expect(OFFICIAL_BALANCE.figures.length).toBeGreaterThan(0);

    const ids = new Set(OFFICIAL_BALANCE.figures.map((figure) => figure.id));
    expect(ids.has("fallecidos")).toBe(true);
    expect(ids.has("heridos")).toBe(true);
    expect(ids.has("desaparecidos")).toBe(true);

    for (const figure of OFFICIAL_BALANCE.figures) {
      expect(figure.sourceUrl.startsWith("https://")).toBe(true);
      expect(figure.label.length).toBeGreaterThan(0);
      expect(figure.value.length).toBeGreaterThan(0);
    }

    expect(OFFICIAL_BALANCE.verificationUrl.startsWith("https://")).toBe(
      true
    );
  });
});
