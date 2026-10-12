import { describe, expect, it } from "vitest";
import {
  UsgsFeatureSchema,
  buildUsgsQueryUrl,
  normalizeUsgsFeature,
  parseUsgsResponse,
} from "@/lib/usgs";
import { makeUsgsFeature, makeUsgsPayload } from "./fixtures/usgs";

describe("normalizeUsgsFeature", () => {
  it("convierte coordenadas USGS a longitud, latitud y profundidad", () => {
    const feature = makeUsgsFeature({
      coordinates: [-80.5, 8.5, 10],
      mag: 4.8,
    });

    const row = normalizeUsgsFeature(feature);

    expect(row.longitude).toBe(-80.5);
    expect(row.latitude).toBe(8.5);
    expect(row.depth_km).toBe(10);
    expect(row.magnitude).toBe(4.8);
    expect(row.id).toBe("us7000abcd");
  });

  it("convierte magnitud null en 0 y place null en texto por defecto", () => {
    const row = normalizeUsgsFeature(
      makeUsgsFeature({ mag: null, place: null })
    );

    expect(row.magnitude).toBe(0);
    expect(row.place).toBe("Ubicación no disponible");
  });

  it("convierte milisegundos epoch a ISO 8601 UTC", () => {
    const row = normalizeUsgsFeature(
      makeUsgsFeature({ time: 1_760_000_000_000, updated: 1_760_000_100_000 })
    );

    expect(row.occurred_at_utc).toBe("2025-10-09T08:53:20.000Z");
    expect(row.updated_at_utc).toBe("2025-10-09T08:55:00.000Z");
    expect(row.occurred_at_utc.endsWith("Z")).toBe(true);
  });

  it("normaliza fuente y estado a minúsculas", () => {
    const row = normalizeUsgsFeature(
      makeUsgsFeature({ net: "US", status: "REVIEWED" })
    );

    expect(row.source).toBe("us");
    expect(row.review_status).toBe("reviewed");
  });

  it("marca tsunami_flag solo cuando USGS envía exactamente 1", () => {
    expect(
      normalizeUsgsFeature(makeUsgsFeature({ tsunami: 1 })).tsunami_flag
    ).toBe(1);
    expect(
      normalizeUsgsFeature(makeUsgsFeature({ tsunami: 2 })).tsunami_flag
    ).toBe(0);
    expect(
      normalizeUsgsFeature(makeUsgsFeature({ tsunami: 0 })).tsunami_flag
    ).toBe(0);
  });

  it("conserva el JSON original para auditoría", () => {
    const feature = makeUsgsFeature();
    const row = normalizeUsgsFeature(feature);

    expect(row.raw_json).toBe(JSON.stringify(feature));
    expect(row.raw_json).toContain("us7000abcd");
  });
});

describe("UsgsFeatureSchema", () => {
  it("rechaza un feature sin geometría", () => {
    const result = UsgsFeatureSchema.safeParse({
      id: "us7000bad",
      properties: makeUsgsFeature().properties,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un feature sin id", () => {
    const result = UsgsFeatureSchema.safeParse({
      properties: makeUsgsFeature().properties,
      geometry: makeUsgsFeature().geometry,
    });

    expect(result.success).toBe(false);
  });
});

describe("parseUsgsResponse", () => {
  it("separa features válidos e inválidos sin detener el lote", () => {
    const parsed = parseUsgsResponse(
      makeUsgsPayload([makeUsgsFeature({ id: "ok1" }), { id: "roto" }])
    );

    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0]?.id).toBe("ok1");
    expect(parsed.invalidCount).toBe(1);
  });

  it("rechaza un sobre sin features", () => {
    expect(() => parseUsgsResponse({ error: "no hay datos" })).toThrow(
      "Respuesta de USGS inválida"
    );
    expect(() => parseUsgsResponse("no-json")).toThrow(
      "Respuesta de USGS inválida"
    );
  });
});

describe("buildUsgsQueryUrl", () => {
  const options = {
    days: 7,
    minMagnitude: 2.5,
    orderBy: "time" as const,
    limit: 100,
    center: { latitude: 8.5, longitude: -80.5 },
    radiusKm: 500,
  };

  it("construye la URL con los parámetros del contrato", () => {
    const url = buildUsgsQueryUrl(options, "https://example.org/query");

    expect(url.origin + url.pathname).toBe("https://example.org/query");
    expect(url.searchParams.get("format")).toBe("geojson");
    expect(url.searchParams.get("minmagnitude")).toBe("2.5");
    expect(url.searchParams.get("latitude")).toBe("8.5");
    expect(url.searchParams.get("longitude")).toBe("-80.5");
    expect(url.searchParams.get("maxradiuskm")).toBe("500");
    expect(url.searchParams.get("orderby")).toBe("time");
    expect(url.searchParams.get("limit")).toBe("100");

    const starttime = url.searchParams.get("starttime") ?? "";
    expect(starttime).not.toBe("");
    expect(Number.isFinite(Date.parse(starttime))).toBe(true);
  });

  it("calcula starttime dentro del periodo solicitado", () => {
    const url = buildUsgsQueryUrl(options, "https://example.org/query");
    const starttimeMs = Date.parse(url.searchParams.get("starttime") ?? "");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Margen de 50 ms por el tiempo de ejecución entre la construcción
    // de la URL y la aserción.
    expect(Date.now() - starttimeMs).toBeGreaterThan(sevenDaysMs - 60_000);
    expect(Date.now() - starttimeMs).toBeLessThanOrEqual(sevenDaysMs + 50);
  });

  it("rechaza periodos y magnitudes inválidas", () => {
    expect(() =>
      buildUsgsQueryUrl(
        { ...options, days: 0 },
        "https://example.org/query"
      )
    ).toThrow();
    expect(() =>
      buildUsgsQueryUrl(
        { ...options, minMagnitude: -1 },
        "https://example.org/query"
      )
    ).toThrow();
  });
});
