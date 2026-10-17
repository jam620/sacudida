/**
 * ETL del IGC-UP (Instituto Geográfico Nacional — Universidad de Panamá),
 * la red sísmica local: detecta réplicas menores que USGS no publica.
 *
 * ⚠️ LIMITACIÓN VALIDADA (2026-10-11): el IGC-UP NO expone API, feed JSON
 * ni RSS público estable; difunde boletines por X (@igcpanamaup). Por eso
 * este adaptador está DESACOPLADO y desactivado por defecto: solo importa
 * si se define IGC_UP_FEED_URL apuntando a un endpoint JSON autorizado
 * (propio del IGC-UP o convenido con ellos). No se hace scraping de su
 * cuenta de X: sería frágil, agresivo y sin autorización.
 *
 * Formato esperado del feed (JSON):
 *   { "eventos": [ { "id", "magnitud", "lugar", "latitud", "longitud",
 *     "profundidadKm", "hora" (epoch ms o ISO 8601), "url"? } ] }
 *   — o el mismo array directamente. Los eventos se normalizan al modelo
 *   interno (tabla `earthquakes`) con source "igcup" y se deduplican
 *   contra USGS por cercanía + ventana temporal + magnitud similar.
 */

import { z } from "zod";
import { distanceKm } from "@/lib/geo";
import { toIsoUtc } from "@/lib/format";
import { UpstreamError } from "@/lib/errors";
import type { Earthquake } from "@/types/earthquake";
import type { EarthquakeRow } from "@/types/earthquake";
import { findEarthquakes } from "../repositories/earthquakeRepository";
import { upsertEarthquakeRow } from "../repositories/earthquakeRepository";
import { logSyncAttempt } from "../repositories/observabilityRepository";

export const IGC_SOURCE_ID = "igcup";
export const IGC_OFFICIAL_URL = "https://x.com/igcpanamaup";
export const IGC_SOURCE_LABEL = "IGC-UP";

const FEED_TIMEOUT_MS = 8_000;

/** Tolerancias de deduplicación entre fuentes distintas. */
export const CROSS_SOURCE_TIME_MS = 60_000;
export const CROSS_SOURCE_DISTANCE_KM = 30;
export const CROSS_SOURCE_MAGNITUDE_DELTA = 0.5;

const IgcEventSchema = z.object({
  id: z.union([z.string().min(1).max(64), z.number()]).transform(String),
  magnitud: z.number().finite().min(0).max(10),
  lugar: z.string().trim().max(200).optional().default("Panamá"),
  latitud: z.number().finite().min(-90).max(90),
  longitud: z.number().finite().min(-180).max(180),
  profundidadKm: z.number().finite().min(0).max(800).optional().default(10),
  hora: z.union([
    z.number(),
    z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value)), "fecha inválida"),
  ]),
  url: z.string().url().max(2048).optional(),
});

export type IgcEvent = z.infer<typeof IgcEventSchema>;

function eventTimeMs(hora: number | string): number {
  return typeof hora === "number" ? hora : Date.parse(hora);
}

/**
 * Normaliza un evento del IGC-UP al modelo interno (mismo contrato que
 * normalizeUsgsFeature, pero con prefijo de fuente y enlace oficial).
 */
export function normalizeIgcEvent(raw: unknown): EarthquakeRow {
  const parsed = IgcEventSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UpstreamError("Evento del IGC-UP con formato inválido");
  }
  const event = parsed.data;
  const timeMs = eventTimeMs(event.hora);
  if (!Number.isFinite(timeMs)) {
    throw new UpstreamError("Evento del IGC-UP con fecha inválida");
  }
  const nowIso = toIsoUtc(Date.now());

  return {
    id: `igc-${event.id}`,
    magnitude: event.magnitud,
    place: event.lugar,
    longitude: event.longitud,
    latitude: event.latitud,
    depth_km: event.profundidadKm,
    occurred_at_utc: toIsoUtc(timeMs),
    updated_at_utc: nowIso,
    source: IGC_SOURCE_ID,
    external_url: event.url ?? IGC_OFFICIAL_URL,
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: nowIso,
    raw_json: JSON.stringify(raw),
  };
}

/**
 * ¿Es `candidate` un duplicado de algún evento de otra fuente?
 * Criterio: misma ventana temporal (±60 s), cercanía espacial (≤30 km)
 * y magnitud similar (±0.5). La dedup por ID externo la garantiza la PK.
 */
export function findCrossSourceDuplicate(
  candidate: { time: number; latitude: number; longitude: number; magnitude: number; source: string },
  others: Array<Pick<Earthquake, "time" | "latitude" | "longitude" | "magnitude" | "source">>
): boolean {
  return others.some((other) => {
    if (other.source === candidate.source) {
      return false;
    }
    const timeDeltaMs = Math.abs(other.time - candidate.time);
    if (timeDeltaMs > CROSS_SOURCE_TIME_MS) {
      return false;
    }
    const distance = distanceKm(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: other.latitude, longitude: other.longitude }
    );
    if (distance > CROSS_SOURCE_DISTANCE_KM) {
      return false;
    }
    return Math.abs(other.magnitude - candidate.magnitude) <= CROSS_SOURCE_MAGNITUDE_DELTA;
  });
}

export type IgcImportResult = {
  status: "ok" | "not-configured" | "error";
  imported: number;
  duplicates: number;
  invalid: number;
  error?: string;
};

async function fetchIgcFeed(feedUrl: string): Promise<unknown> {
  const response = await fetch(feedUrl, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new UpstreamError(`El feed del IGC-UP respondió ${response.status}`);
  }
  return response.json();
}

/**
 * Importa eventos del feed del IGC-UP (si está configurado).
 * Fail-safe: nunca lanza; el estado del intento queda en sync_log.
 */
export async function importIgcEarthquakes(): Promise<IgcImportResult> {
  const feedUrl = process.env.IGC_UP_FEED_URL;
  if (!feedUrl) {
    try {
      logSyncAttempt({ source: IGC_SOURCE_ID, status: "not-configured" });
    } catch {
      // Sin observabilidad el resultado sigue siendo válido.
    }
    return { status: "not-configured", imported: 0, duplicates: 0, invalid: 0 };
  }

  try {
    const payload = await fetchIgcFeed(feedUrl);
    const listRaw = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { eventos?: unknown[] }).eventos)
        ? ((payload as { eventos: unknown[] }).eventos as unknown[])
        : [];

    // Ventana de dedup: eventos recientes de otras fuentes.
    const existing = findEarthquakes({
      minMagnitude: 0,
      days: 2,
      orderBy: "time",
    });

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const raw of listRaw) {
      let row: EarthquakeRow;
      try {
        row = normalizeIgcEvent(raw);
      } catch {
        invalid += 1;
        continue;
      }
      const duplicate = findCrossSourceDuplicate(
        {
          time: Date.parse(row.occurred_at_utc),
          latitude: row.latitude,
          longitude: row.longitude,
          magnitude: row.magnitude,
          source: row.source,
        },
        existing
      );
      if (duplicate) {
        duplicates += 1;
        continue;
      }
      upsertEarthquakeRow(row);
      imported += 1;
    }

    try {
      logSyncAttempt({ source: IGC_SOURCE_ID, status: "ok", imported });
    } catch {
      // Ignorado a propósito.
    }
    return { status: "ok", imported, duplicates, invalid };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    try {
      logSyncAttempt({ source: IGC_SOURCE_ID, status: "error", error: message });
    } catch {
      // Ignorado a propósito.
    }
    return { status: "error", imported: 0, duplicates: 0, invalid: 0, error: message };
  }
}
