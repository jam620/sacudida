/**
 * Repositorio de sismos: encapsula TODO el SQL de la tabla `earthquakes`.
 *
 * Reglas (CLAUDE.md / docs/04):
 * - Ningún componente de UI ejecuta SQL; solo este módulo.
 * - Toda consulta usa prepared statements (sin concatenar valores).
 * - El repositorio devuelve tipos del dominio, no filas crudas.
 * - Orden y límite provienen de constantes/valores validados.
 */

import { toIsoUtc } from "@/lib/format";
import {
  DEFAULT_DAYS,
  MAX_EVENTS_PER_QUERY,
  RELEVANT_MAGNITUDE,
} from "@/lib/constants";
import type {
  Earthquake,
  EarthquakeFilters,
  EarthquakeRow,
} from "@/types/earthquake";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";

/** Cláusulas permitidas para ORDER BY (lista blanca anti-inyección). */
const ORDER_BY_CLAUSES = {
  time: "occurred_at_utc DESC",
  magnitude: "magnitude DESC",
} as const;

function orderByClause(orderBy: EarthquakeFilters["orderBy"]): string {
  return ORDER_BY_CLAUSES[orderBy] ?? ORDER_BY_CLAUSES.time;
}

function cutoffIsoUtc(days: number): string {
  return toIsoUtc(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Lista de eventos filtrada por magnitud mínima y periodo. */
export function findEarthquakes(
  filters: EarthquakeFilters,
  db: SqliteDatabase = getDatabase()
): Earthquake[] {
  initializeDatabase(db);

  const rows = db
    .prepare(
      `
      SELECT *
      FROM earthquakes
      WHERE magnitude >= ?
        AND occurred_at_utc >= ?
      ORDER BY ${orderByClause(filters.orderBy)}
      LIMIT ?
      `
    )
    .all(filters.minMagnitude, cutoffIsoUtc(filters.days), MAX_EVENTS_PER_QUERY) as SqliteRow[];

  return rows.map(mapRowToEarthquake);
}

/** Evento por ID original de USGS, o `null` si no existe. */
export function findEarthquakeById(
  id: string,
  db: SqliteDatabase = getDatabase()
): Earthquake | null {
  initializeDatabase(db);

  const row = db
    .prepare("SELECT * FROM earthquakes WHERE id = ?")
    .get(id) as SqliteRow | undefined;

  return row ? mapRowToEarthquake(row) : null;
}

/** Eventos relevantes (magnitud >= 4.5) dentro del periodo indicado. */
export function findRelevantEarthquakes(
  options: { days?: number; limit?: number } = {},
  db: SqliteDatabase = getDatabase()
): Earthquake[] {
  initializeDatabase(db);

  const days = options.days ?? DEFAULT_DAYS;
  const limit = Math.min(options.limit ?? MAX_EVENTS_PER_QUERY, MAX_EVENTS_PER_QUERY);

  const rows = db
    .prepare(
      `
      SELECT *
      FROM earthquakes
      WHERE magnitude >= ?
        AND occurred_at_utc >= ?
      ORDER BY occurred_at_utc DESC
      LIMIT ?
      `
    )
    .all(RELEVANT_MAGNITUDE, cutoffIsoUtc(days), limit) as SqliteRow[];

  return rows.map(mapRowToEarthquake);
}

/** Total de eventos almacenados dentro del periodo. */
export function countEarthquakes(
  days: number,
  db: SqliteDatabase = getDatabase()
): number {
  initializeDatabase(db);

  const row = db
    .prepare("SELECT COUNT(*) AS total FROM earthquakes WHERE occurred_at_utc >= ?")
    .get(cutoffIsoUtc(days)) as { total: number } | undefined;

  return row ? Number(row.total) : 0;
}

/** Elimina eventos anteriores a N días y devuelve cuántos borró. */
export function deleteOldEarthquakes(
  days: number,
  db: SqliteDatabase = getDatabase()
): number {
  initializeDatabase(db);

  const result = db
    .prepare("DELETE FROM earthquakes WHERE occurred_at_utc < ?")
    .run(cutoffIsoUtc(days));

  return Number(result.changes);
}

/** `updated_at_utc` almacenado de un evento, para decidir si sincronizar. */
export function findUpdatedAtUtcById(
  id: string,
  db: SqliteDatabase = getDatabase()
): string | null {
  const row = db
    .prepare("SELECT updated_at_utc FROM earthquakes WHERE id = ?")
    .get(id) as { updated_at_utc: string } | undefined;

  return row ? row.updated_at_utc : null;
}

/**
 * Evento más fuerte (posible terremoto principal) del periodo.
 * Empate de magnitud → el más reciente.
 */
export function findStrongestEarthquake(
  options: { days?: number; minMagnitude: number },
  db: SqliteDatabase = getDatabase()
): Earthquake | null {
  initializeDatabase(db);

  const days = options.days ?? DEFAULT_DAYS;
  const row = db
    .prepare(
      `
      SELECT *
      FROM earthquakes
      WHERE magnitude >= ?
        AND occurred_at_utc >= ?
      ORDER BY magnitude DESC, occurred_at_utc DESC
      LIMIT 1
      `
    )
    .get(options.minMagnitude, cutoffIsoUtc(days)) as SqliteRow | undefined;

  return row ? mapRowToEarthquake(row) : null;
}

/** Conteo de réplicas posteriores a un terremoto principal. */
export type AftershockCounts = {
  total: number;
  lastHour: number;
  last24h: number;
};

export function countAftershocksSince(
  mainshockAtIsoUtc: string,
  options: { minMagnitude?: number } = {},
  db: SqliteDatabase = getDatabase()
): AftershockCounts {
  initializeDatabase(db);

  const minMagnitude = options.minMagnitude ?? 0;
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN occurred_at_utc >= ? THEN 1 ELSE 0 END) AS lastHour,
        SUM(CASE WHEN occurred_at_utc >= ? THEN 1 ELSE 0 END) AS last24h
      FROM earthquakes
      WHERE occurred_at_utc > ?
        AND magnitude >= ?
      `
    )
    .get(
      cutoffIsoUtc(1 / 24),
      cutoffIsoUtc(1),
      mainshockAtIsoUtc,
      minMagnitude
    ) as { total: number; lastHour: number | null; last24h: number | null } | undefined;

  return {
    total: row ? Number(row.total) : 0,
    lastHour: row ? Number(row.lastHour ?? 0) : 0,
    last24h: row ? Number(row.last24h ?? 0) : 0,
  };
}

/**
 * Upsert idempotente: inserta o actualiza SOLO si `updated_at_utc`
 * del dato entrante difiere del almacenado (docs/03). Si no cambió,
 * no se escribe nada.
 */
export function upsertEarthquakeRow(
  row: EarthquakeRow,
  db: SqliteDatabase = getDatabase()
): void {
  initializeDatabase(db);

  db.prepare(
    `
    INSERT INTO earthquakes (
      id, magnitude, place, longitude, latitude, depth_km,
      occurred_at_utc, updated_at_utc, source, external_url,
      tsunami_flag, review_status, created_at, raw_json
    )
    VALUES (
      @id, @magnitude, @place, @longitude, @latitude, @depth_km,
      @occurred_at_utc, @updated_at_utc, @source, @external_url,
      @tsunami_flag, @review_status, @created_at, @raw_json
    )
    ON CONFLICT(id) DO UPDATE SET
      magnitude = excluded.magnitude,
      place = excluded.place,
      longitude = excluded.longitude,
      latitude = excluded.latitude,
      depth_km = excluded.depth_km,
      occurred_at_utc = excluded.occurred_at_utc,
      updated_at_utc = excluded.updated_at_utc,
      source = excluded.source,
      external_url = excluded.external_url,
      tsunami_flag = excluded.tsunami_flag,
      review_status = excluded.review_status,
      raw_json = excluded.raw_json
    WHERE earthquakes.updated_at_utc <> excluded.updated_at_utc
    `
  ).run(row);
}

/** Ejecuta `fn` dentro de una transacción SQL. */
export function runInTransaction<T>(fn: () => T, db: SqliteDatabase = getDatabase()): T {
  return db.transaction(fn)();
}

type SqliteRow = {
  id: unknown;
  magnitude: unknown;
  place: unknown;
  longitude: unknown;
  latitude: unknown;
  depth_km: unknown;
  occurred_at_utc: unknown;
  updated_at_utc: unknown;
  source: unknown;
  external_url: unknown;
  tsunami_flag: unknown;
  review_status: unknown;
  [key: string]: unknown;
};

/** Fila SQLite → tipo de dominio (epoch milisegundos para fechas). */
export function mapRowToEarthquake(row: SqliteRow): Earthquake {
  const occurredAtUtc = String(row.occurred_at_utc);
  const updatedAtUtc = String(row.updated_at_utc);

  const time = Date.parse(occurredAtUtc);
  const updated = Date.parse(updatedUtcSafe(updatedAtUtc));

  if (!Number.isFinite(time) || !Number.isFinite(updated)) {
    throw new Error(
      `Fechas inválidas en el evento "${String(row.id)}": ` +
        `occurred_at_utc=${occurredAtUtc}, updated_at_utc=${updatedAtUtc}`
    );
  }

  return {
    id: String(row.id),
    magnitude: Number(row.magnitude),
    place: row.place === null ? "Ubicación no disponible" : String(row.place),
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    depthKm: Number(row.depth_km),
    time,
    updated,
    source: String(row.source),
    url: String(row.external_url),
    tsunami: Number(row.tsunami_flag) === 1,
    status: String(row.review_status),
  };
}

function updatedUtcSafe(value: string): string {
  return value.length > 0 ? value : "1970-01-01T00:00:00.000Z";
}
