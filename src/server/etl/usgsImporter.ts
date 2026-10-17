/**
 * ETL: descarga eventos de USGS, valida, normaliza y sincroniza en SQLite.
 *
 * Reglas (CLAUDE.md / docs/03):
 * - La respuesta siempre se valida con Zod.
 * - Un feature inválido se descarta sin detener la importación.
 * - El upsert es idempotente: si `updated_at_utc` no cambió, no se escribe.
 * - Se guarda el JSON original (`raw_json`) para auditoría.
 */

import {
  DEFAULT_DAYS,
  DEFAULT_MIN_MAGNITUDE,
  MAX_DAYS,
  SYNC_EVENTS_LIMIT,
  PANAMA_CENTER,
  SEARCH_RADIUS_KM,
  USGS_BASE_URL_DEFAULT,
  USGS_TIMEOUT_MS,
} from "@/lib/constants";
import { UpstreamError } from "@/lib/errors";
import { toIsoUtc } from "@/lib/format";
import type { LatLng } from "@/lib/geo";
import {
  buildUsgsQueryUrl,
  normalizeUsgsFeature,
  parseUsgsResponse,
} from "@/lib/usgs";
import type { UsgsFeature } from "@/lib/usgs";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";
import {
  deleteOldEarthquakes,
  findUpdatedAtUtcById,
  runInTransaction,
  upsertEarthquakeRow,
} from "../repositories/earthquakeRepository";
import { setSettingValue } from "../repositories/settingsRepository";
import { logSyncAttempt } from "../repositories/observabilityRepository";

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  /** Eventos antiguos eliminados de la caché local (> 30 días). */
  pruned: number;
  /** IDs insertados en esta tanda (para avisos push de eventos nuevos). */
  insertedIds: string[];
  /** Momento UTC en que se recibió la respuesta del proveedor. */
  receivedAtIso: string | null;
};

export type ImportOptions = {
  days?: number;
  minMagnitude?: number;
  orderBy?: "time" | "magnitude";
  limit?: number;
};

export const LAST_SYNC_SETTING_KEY = "lastSyncAt";

function envCenter(): LatLng {
  const latitude = Number(process.env.PANAMA_LAT ?? PANAMA_CENTER.latitude);
  const longitude = Number(process.env.PANAMA_LON ?? PANAMA_CENTER.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ...PANAMA_CENTER };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ...PANAMA_CENTER };
  }
  return { latitude, longitude };
}

function envRadiusKm(): number {
  const radius = Number(process.env.SEARCH_RADIUS_KM ?? SEARCH_RADIUS_KM);
  return Number.isFinite(radius) && radius > 0 && radius <= 20_000
    ? radius
    : SEARCH_RADIUS_KM;
}

/**
 * Cliente USGS: descarga y valida una página de resultados.
 * Lanza `UpstreamError` ante cualquier fallo del proveedor.
 */
export async function fetchUsgsEarthquakes(
  options: Required<Pick<ImportOptions, "days" | "minMagnitude" | "orderBy" | "limit">>
): Promise<{ features: UsgsFeature[]; invalidCount: number }> {
  const baseUrl = process.env.USGS_BASE_URL ?? USGS_BASE_URL_DEFAULT;

  let url: URL;
  try {
    url = buildUsgsQueryUrl(
      {
        days: options.days,
        minMagnitude: options.minMagnitude,
        orderBy: options.orderBy,
        limit: options.limit,
        center: envCenter(),
        radiusKm: envRadiusKm(),
      },
      baseUrl
    );
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error ? error.message : "Parámetros inválidos para USGS"
    );
  }

  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(USGS_TIMEOUT_MS),
      headers: { accept: "application/geo+json, application/json" },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new UpstreamError(
        `Tiempo de espera agotado al consultar USGS (${USGS_TIMEOUT_MS / 1000}s)`
      );
    }
    throw new UpstreamError("No fue posible conectar con USGS");
  }

  if (!response.ok) {
    throw new UpstreamError(`USGS respondió con estado ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UpstreamError("USGS devolvió una respuesta no interpretable");
  }

  try {
    return parseUsgsResponse(payload);
  } catch {
    throw new UpstreamError("Respuesta de USGS inválida");
  }
}

/**
 * Sincroniza eventos desde USGS hacia SQLite (idempotente).
 * Devuelve cuántos se insertaron, actualizaron o saltaron.
 */
export async function importUsgsEarthquakes(
  options: ImportOptions = {}
): Promise<ImportResult> {
  const days = options.days ?? DEFAULT_DAYS;
  const minMagnitude = options.minMagnitude ?? DEFAULT_MIN_MAGNITUDE;
  const orderBy = options.orderBy ?? "time";
  const limit = options.limit ?? SYNC_EVENTS_LIMIT;

  const startedAtIso = toIsoUtc(Date.now());
  let features: ReturnType<typeof parseUsgsResponse>["features"];
  let invalidCount = 0;
  try {
    const fetched = await fetchUsgsEarthquakes({ days, minMagnitude, orderBy, limit });
    features = fetched.features;
    invalidCount = fetched.invalidCount;
  } catch (error) {
    try {
      logSyncAttempt({
        source: "usgs",
        status: "error",
        error: error instanceof Error ? error.message.slice(0, 200) : "error",
        startedAt: startedAtIso,
      });
    } catch {
      // La observabilidad no debe enmascarar el fallo original.
    }
    throw error;
  }
  const receivedAtIso = toIsoUtc(Date.now());

  const db: SqliteDatabase = getDatabase();
  initializeDatabase(db);

  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    pruned: 0,
    insertedIds: [],
    receivedAtIso,
  };

  runInTransaction(() => {
    for (const feature of features) {
      let row;
      try {
        row = normalizeUsgsFeature(feature);
      } catch {
        // El feature pasó la validación de forma pero contenía valores
        // no representables (por ejemplo, fechas fuera de rango).
        result.skipped += 1;
        continue;
      }

      const existingUpdatedAt = findUpdatedAtUtcById(row.id, db);
      if (existingUpdatedAt === null) {
        result.inserted += 1;
        result.insertedIds.push(row.id);
      } else if (existingUpdatedAt !== row.updated_at_utc) {
        result.updated += 1;
      } else {
        result.skipped += 1;
      }

      upsertEarthquakeRow(row, db);
    }
  }, db);

  result.skipped += invalidCount;

  // La caché local solo conserva el periodo consultable máximo (30 días),
  // para que no crezca sin límite en despliegues persistentes.
  result.pruned = deleteOldEarthquakes(MAX_DAYS, db);

  setSettingValue(LAST_SYNC_SETTING_KEY, toIsoUtc(Date.now()), db);

  try {
    logSyncAttempt({
      source: "usgs",
      status: "ok",
      imported: result.inserted,
      startedAt: startedAtIso,
    });
  } catch {
    // Sin observabilidad el import sigue siendo válido.
  }

  return result;
}
