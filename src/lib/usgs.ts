/**
 * Cliente de USGS (FDNWS event API): esquemas de validación Zod,
 * normalización de features GeoJSON y construcción de la URL de consulta.
 *
 * Reglas del contrato (CLAUDE.md):
 * - No se inventan campos: solo se leen los que USGS publica.
 * - El mapeo USGS → SQLite definido en CLAUDE.md es vinculante.
 * - Un feature inválido se descarta; no debe tumbar toda la importación.
 */

import { z } from "zod";
import type { EarthquakeRow } from "@/types/earthquake";
import { toIsoUtc } from "./format";
import type { LatLng } from "./geo";

/** Feature GeoJSON de USGS con solo los campos que el MVP consume. */
export const UsgsFeatureSchema = z.object({
  id: z.string().min(1),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    updated: z.number(),
    url: z.string().min(1),
    net: z.string().min(1),
    tsunami: z.number(),
    status: z.string().min(1),
  }),
  geometry: z.object({
    // GeoJSON: [longitud, latitud, profundidad_km]
    coordinates: z.tuple([z.number(), z.number(), z.number()]),
  }),
});

export type UsgsFeature = z.infer<typeof UsgsFeatureSchema>;

/**
 * Validación estructural del sobre de la respuesta. Los features se
 * validan individualmente para poder descartar los inválidos de forma
 * aislada (docs/03: "un evento inválido no debe detener la importación").
 */
export const UsgsResponseSchema = z.object({
  features: z.array(z.unknown()),
});

export type ParsedUsgsResponse = {
  features: UsgsFeature[];
  invalidCount: number;
};

/**
 * Valida la respuesta de USGS y separa los features válidos de los
 * inválidos. Lanza `Error` si el sobre no tiene la estructura esperada.
 */
export function parseUsgsResponse(payload: unknown): ParsedUsgsResponse {
  const envelope = UsgsResponseSchema.safeParse(payload);

  if (!envelope.success) {
    throw new Error("Respuesta de USGS inválida");
  }

  const features: UsgsFeature[] = [];
  let invalidCount = 0;

  for (const candidate of envelope.data.features) {
    const parsed = UsgsFeatureSchema.safeParse(candidate);
    if (parsed.success) {
      features.push(parsed.data);
    } else {
      invalidCount += 1;
    }
  }

  return { features, invalidCount };
}

const DEFAULT_PLACE = "Ubicación no disponible";

/**
 * Normaliza un feature USGS válido a una fila de la tabla `earthquakes`
 * (sin `created_at`, que se asigna al insertar). Mapeo exacto de CLAUDE.md.
 */
export function normalizeUsgsFeature(feature: UsgsFeature): EarthquakeRow {
  const [longitude, latitude, depthKm] = feature.geometry.coordinates;

  return {
    id: feature.id,
    magnitude: feature.properties.mag ?? 0,
    place: feature.properties.place ?? DEFAULT_PLACE,
    longitude,
    latitude,
    depth_km: depthKm,
    occurred_at_utc: toIsoUtc(feature.properties.time),
    updated_at_utc: toIsoUtc(feature.properties.updated),
    source: feature.properties.net.toLowerCase(),
    external_url: feature.properties.url,
    tsunami_flag: feature.properties.tsunami === 1 ? 1 : 0,
    review_status: feature.properties.status.toLowerCase(),
    created_at: toIsoUtc(Date.now()),
    raw_json: JSON.stringify(feature),
  };
}

export type UsgsQueryOptions = {
  days: number;
  minMagnitude: number;
  orderBy: "time" | "magnitude";
  limit: number;
  center: LatLng;
  radiusKm: number;
};

/** Construye la URL de consulta a USGS con los parámetros del contrato. */
export function buildUsgsQueryUrl(
  options: UsgsQueryOptions,
  baseUrl: string
): URL {
  if (!Number.isFinite(options.days) || options.days <= 0) {
    throw new Error(`Periodo inválido para consultar USGS: ${options.days}`);
  }
  if (
    !Number.isFinite(options.minMagnitude) ||
    options.minMagnitude < 0
  ) {
    throw new Error(
      `Magnitud mínima inválida para consultar USGS: ${options.minMagnitude}`
    );
  }

  const url = new URL(baseUrl);
  const starttime = new Date(
    Date.now() - options.days * 24 * 60 * 60 * 1000
  ).toISOString();

  url.searchParams.set("format", "geojson");
  url.searchParams.set("starttime", starttime);
  url.searchParams.set("minmagnitude", String(options.minMagnitude));
  url.searchParams.set("latitude", String(options.center.latitude));
  url.searchParams.set("longitude", String(options.center.longitude));
  url.searchParams.set("maxradiuskm", String(options.radiusKm));
  url.searchParams.set("orderby", options.orderBy);
  url.searchParams.set("limit", String(options.limit));

  return url;
}
