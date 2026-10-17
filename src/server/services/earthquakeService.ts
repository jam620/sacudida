/**
 * Servicio de sismos: lógica de negocio (validación de filtros,
 * relevancia, distancia, réplicas) y orquestación repositorio/ETL.
 * No conoce HTTP ni SQL directamente.
 */

import { z } from "zod";
import {
  DEFAULT_DAYS,
  DEFAULT_MIN_MAGNITUDE,
  DEFAULT_ORDER_BY,
  HIGH_IMPACT_MAGNITUDE,
  LOCAL_PRIORITY_DISTANCE_KM,
  MAX_DAYS,
  MAX_MAGNITUDE_LIMIT,
  MIN_MAGNITUDE_LIMIT,
  RELEVANT_MAGNITUDE,
  SYNC_EVENTS_LIMIT,
  SYNC_MIN_MAGNITUDE,
  SYNC_STALE_AFTER_MS,
} from "@/lib/constants";
import { ValidationError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import type { Earthquake, EarthquakeFilters } from "@/types/earthquake";
import { LAST_SYNC_SETTING_KEY, importUsgsEarthquakes, fetchUsgsEarthquakes } from "../etl/usgsImporter";
import {
  countAftershocksSince,
  countEarthquakes,
  findEarthquakeById,
  findEarthquakes,
  findRelevantEarthquakes,
  findStrongestEarthquake,
} from "../repositories/earthquakeRepository";
import { getSettingValue } from "../repositories/settingsRepository";
import { toIsoUtc } from "@/lib/format";

export { distanceKm };

/** Parámetros ausentes o vacíos ("", null) caen en el valor por defecto. */
const emptyToUndefined = (value: unknown): unknown =>
  value === null || value === undefined || value === "" ? undefined : value;

export const EarthquakeFiltersSchema = z.object({
  minMagnitude: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .min(MIN_MAGNITUDE_LIMIT)
      .max(MAX_MAGNITUDE_LIMIT)
      .default(DEFAULT_MIN_MAGNITUDE)
  ),
  days: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_DAYS)
      .default(DEFAULT_DAYS)
  ),
  orderBy: z.preprocess(
    emptyToUndefined,
    z.enum(["time", "magnitude"]).default(DEFAULT_ORDER_BY)
  ),
});

/** Valida y normaliza filtros de entrada. Lanza `ValidationError`. */
export function parseFilters(input: unknown): EarthquakeFilters {
  const result = EarthquakeFiltersSchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const detail = issue
      ? `${issue.path.join(".") || "valor"}: ${issue.message}`
      : "formato no reconocido";
    throw new ValidationError(`Filtros inválidos (${detail})`);
  }

  return result.data;
}

/** Lista de eventos según filtros validados. */
export function getEarthquakes(filters: EarthquakeFilters): Earthquake[] {
  return findEarthquakes(filters);
}

/** Detalle de un evento por ID de USGS. Lanza si el ID está vacío. */
export function getEarthquake(id: string): Earthquake | null {
  if (!id || id.trim().length === 0) {
    throw new ValidationError("El ID del evento es requerido");
  }
  return findEarthquakeById(id.trim());
}

/** Eventos relevantes (M >= 4.5) del periodo indicado. */
export function getRelevantEarthquakes(
  options: { days?: number; limit?: number } = {}
): Earthquake[] {
  return findRelevantEarthquakes(options);
}

/** Banner de "sismo relevante" a partir de M 4.5 (CLAUDE.md). */
export function isRelevant(earthquake: Earthquake): boolean {
  return earthquake.magnitude >= RELEVANT_MAGNITUDE;
}

/** Alto impacto potencial a partir de M 5.5 (docs/05). */
export function isHighImpact(earthquake: Earthquake): boolean {
  return earthquake.magnitude >= HIGH_IMPACT_MAGNITUDE;
}

/** Prioridad local: evento a menos de 100 km del usuario (docs/05). */
export function isLocalPriority(
  earthquake: Earthquake,
  userLocation: LatLng
): boolean {
  return (
    distanceKm(userLocation, {
      latitude: earthquake.latitude,
      longitude: earthquake.longitude,
    }) <= LOCAL_PRIORITY_DISTANCE_KM
  );
}

/**
 * Umbral para considerar un evento como "terremoto principal" de una
 * secuencia (con réplicas contables). Por debajo, no se muestra el
 * contador de réplicas.
 */
export const MAINSHOCK_THRESHOLD = 6.5;

export type AftershockSummary = {
  mainshock: Earthquake;
  aftershocks: { total: number; lastHour: number; last24h: number };
};

/**
 * Resumen de réplicas: terremoto principal reciente (M >= 6.5 en 30 días)
 * y cuántos sismos M >= 2.5 ocurrieron después, en total / última hora /
 * últimas 24 h. Sin secuencia activa devuelve null (la UI lo oculta).
 */
export function getAftershockSummary(): AftershockSummary | null {
  const mainshock = findStrongestEarthquake({
    days: 30,
    minMagnitude: MAINSHOCK_THRESHOLD,
  });

  if (mainshock === null) {
    return null;
  }

  const aftershocks = countAftershocksSince(
    new Date(mainshock.time).toISOString(),
    { minMagnitude: DEFAULT_MIN_MAGNITUDE }
  );

  return { mainshock, aftershocks };
}

/** La sincronización automática se desactiva en pruebas o por configuración. */
export function autoSyncEnabled(): boolean {
  return (
    process.env.DISABLE_AUTO_SYNC !== "1" && process.env.NODE_ENV !== "test"
  );
}

const AUTO_SYNC_STALE_AFTER_MS = SYNC_STALE_AFTER_MS; // modo en vivo
const AUTO_SYNC_RETRY_BACKOFF_MS = 15_000;

/**
 * Rescate de secuencia: la ventana corta de sincronización (DEFAULT_DAYS)
 * deja fuera al terremoto principal cuando la emergencia cumple días, y
 * sin él desaparecen el contador y la gráfica de réplicas. Si tras la
 * sincronización normal no hay M >= 6.5 en la base, se importa la
 * secuencia completa (M >= 2.5, las más fuertes primero, 35 días).
 */
const SEQUENCE_BACKFILL_DAYS = 35;
const SEQUENCE_ABSENT_RETRY_MS = 60 * 60_000;

let ensureInFlight: Promise<void> | null = null;
let lastFailedAttemptMs = 0;
let sequenceAbsentUntilMs = 0;

async function backfillMainshockSequence(): Promise<void> {
  if (Date.now() < sequenceAbsentUntilMs) {
    return;
  }
  // Consulta barata primero: ¿existe un terremoto principal reciente?
  const probe = await fetchUsgsEarthquakes({
    days: SEQUENCE_BACKFILL_DAYS,
    minMagnitude: MAINSHOCK_THRESHOLD,
    orderBy: "magnitude",
    limit: 3,
  });
  if (probe.features.length === 0) {
    // Sin secuencia activa: no repetir la sonda durante una hora.
    sequenceAbsentUntilMs = Date.now() + SEQUENCE_ABSENT_RETRY_MS;
    return;
  }
  await importUsgsEarthquakes({
    days: SEQUENCE_BACKFILL_DAYS,
    minMagnitude: DEFAULT_MIN_MAGNITUDE,
    orderBy: "magnitude",
    limit: SYNC_EVENTS_LIMIT,
  });
}

function isCacheFresh(): boolean {
  const lastSyncAt = getSettingValue(LAST_SYNC_SETTING_KEY);
  if (lastSyncAt === null) {
    return false;
  }
  const lastSyncMs = Date.parse(lastSyncAt);
  return Number.isFinite(lastSyncMs) && Date.now() - lastSyncMs < AUTO_SYNC_STALE_AFTER_MS;
}

/**
 * Mantiene la caché al día sin intervención del usuario (modo en vivo):
 * - Arranque en frío (base vacía): sincroniza.
 * - Datos con más de SYNC_STALE_AFTER_MS: re-sincroniza antes de
 *   responder, de modo que cada sondeo de la UI traiga réplicas nuevas.
 * - Fail-safe: si USGS falla se devuelve lo que haya; tras un fallo se
 *   esperan 15 s antes de reintentar para no saturar al proveedor.
 * - Llamadas concurrentes comparten la misma sincronización en curso.
 */
export async function ensureFreshData(): Promise<void> {
  if (!autoSyncEnabled()) {
    return;
  }

  const hasData = countEarthquakes(DEFAULT_DAYS) > 0;
  if (hasData && isCacheFresh()) {
    return;
  }

  const inBackoff =
    ensureInFlight === null &&
    lastFailedAttemptMs > 0 &&
    Date.now() - lastFailedAttemptMs < AUTO_SYNC_RETRY_BACKOFF_MS;
  if (inBackoff) {
    return;
  }

  ensureInFlight ??= importUsgsEarthquakes({
    days: DEFAULT_DAYS,
    minMagnitude: SYNC_MIN_MAGNITUDE,
    limit: SYNC_EVENTS_LIMIT,
  })
    .then(() => {
      if (
        findStrongestEarthquake({
          days: 30,
          minMagnitude: MAINSHOCK_THRESHOLD,
        }) === null
      ) {
        return backfillMainshockSequence();
      }
      return undefined;
    })
    .then(() => {
      lastFailedAttemptMs = 0;
    })
    .catch(() => {
      lastFailedAttemptMs = Date.now();
    })
    .then(() => undefined)
    .finally(() => {
      ensureInFlight = null;
    });

  await ensureInFlight;
}

/** Reinicia el estado interno del auto-sync (solo para pruebas). */
export function resetAutoSyncStateForTests(): void {
  ensureInFlight = null;
  lastFailedAttemptMs = 0;
  sequenceAbsentUntilMs = 0;
}

/**
 * Lista de eventos con caché siempre fresca: sincroniza si hace falta
 * (frío o vencida) y luego consulta. Si USGS falla, se devuelve el
 * último conjunto válido (fail-safe, CLAUDE.md principio 3).
 */
export async function getEarthquakesWithAutoSync(
  filters: EarthquakeFilters
): Promise<Earthquake[]> {
  await ensureFreshData();
  return getEarthquakes(filters);
}

/** Utilidad para rutas que exponen la frescura (ISO UTC o null). */
export function getLastSyncAtIso(): string | null {
  const lastSyncAt = getSettingValue(LAST_SYNC_SETTING_KEY);
  return lastSyncAt !== null && Number.isFinite(Date.parse(lastSyncAt))
    ? lastSyncAt
    : null;
}

export { toIsoUtc };
