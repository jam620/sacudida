/**
 * Fixtures de respuestas USGS (docs/08: usar mocks, nunca llamadas reales).
 */

import type { UsgsFeature } from "@/lib/usgs";

const MINUTE_MS = 60_000;

export type FeatureOverrides = {
  id?: string;
  mag?: number | null;
  place?: string | null;
  time?: number;
  updated?: number;
  url?: string;
  net?: string;
  tsunami?: number;
  status?: string;
  coordinates?: [number, number, number];
};

export function makeUsgsFeature(overrides: FeatureOverrides = {}): UsgsFeature {
  // Fechas por defecto RELATIVAS a ahora: los fixtures deben seguir
  // siendo "recientes" pase el tiempo que pase (docs/08), o la poda de
  // la caché (>30 días) los eliminaría en medio de la prueba.
  const recentTime = Date.now() - 60 * MINUTE_MS;
  const recentUpdated = Date.now() - 50 * MINUTE_MS;

  return {
    id: overrides.id ?? "us7000abcd",
    properties: {
      // "in" para distinguir null explícito (válido en USGS) de ausencia.
      mag: "mag" in overrides ? (overrides.mag as number | null) : 4.8,
      place:
        "place" in overrides
          ? (overrides.place as string | null)
          : "48 km al sur de Punta de Burica, Panamá",
      time: overrides.time ?? recentTime,
      updated: overrides.updated ?? recentUpdated,
      url:
        overrides.url ??
        "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
      net: overrides.net ?? "us",
      tsunami: overrides.tsunami ?? 0,
      status: overrides.status ?? "reviewed",
    },
    geometry: {
      coordinates: overrides.coordinates ?? [-80.5, 8.5, 10],
    },
  };
}

export function makeUsgsPayload(features: unknown[]): { features: unknown[] } {
  return { features };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
