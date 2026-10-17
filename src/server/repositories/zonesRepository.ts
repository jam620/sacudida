/**
 * Repositorio de zonas vigiladas (`watched_zones`).
 * El usuario elige explícitamente qué puntos guardar (hogar, trabajo);
 * la ubicación en vivo nunca se persiste (CLAUDE.md).
 */

import { toIsoUtc } from "@/lib/format";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";
import type { WatchedZone, WatchedZoneInput } from "@/types/alerts";

type ZoneRow = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  min_magnitude: number;
  active: number;
};

function mapRow(row: ZoneRow): WatchedZone {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusKm: row.radius_km,
    minMagnitude: row.min_magnitude,
    active: row.active === 1,
  };
}

export function listWatchedZones(
  db: SqliteDatabase = getDatabase()
): WatchedZone[] {
  initializeDatabase(db);
  const rows = db
    .prepare("SELECT * FROM watched_zones ORDER BY created_at, id")
    .all() as ZoneRow[];
  return rows.map(mapRow);
}

export function createWatchedZone(
  input: WatchedZoneInput,
  db: SqliteDatabase = getDatabase()
): WatchedZone {
  initializeDatabase(db);
  const result = db
    .prepare(
      `
      INSERT INTO watched_zones
        (name, latitude, longitude, radius_km, min_magnitude, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.name,
      input.latitude,
      input.longitude,
      input.radiusKm,
      input.minMagnitude,
      input.active === false ? 0 : 1,
      toIsoUtc(Date.now())
    );
  const id = Number(result.lastInsertRowid);
  return { id, ...input, active: input.active !== false };
}

export function updateWatchedZone(
  id: number,
  patch: Partial<WatchedZoneInput>,
  db: SqliteDatabase = getDatabase()
): WatchedZone | null {
  const current = listWatchedZones(db).find((zone) => zone.id === id);
  if (!current) {
    return null;
  }
  const next: WatchedZoneInput = {
    name: patch.name ?? current.name,
    latitude: patch.latitude ?? current.latitude,
    longitude: patch.longitude ?? current.longitude,
    radiusKm: patch.radiusKm ?? current.radiusKm,
    minMagnitude: patch.minMagnitude ?? current.minMagnitude,
    active: patch.active ?? current.active,
  };
  db.prepare(
    `
    UPDATE watched_zones
    SET name = ?, latitude = ?, longitude = ?, radius_km = ?,
        min_magnitude = ?, active = ?
    WHERE id = ?
    `
  ).run(
    next.name,
    next.latitude,
    next.longitude,
    next.radiusKm,
    next.minMagnitude,
    next.active === false ? 0 : 1,
    id
  );
  return { id, ...next, active: next.active !== false };
}

export function deleteWatchedZone(
  id: number,
  db: SqliteDatabase = getDatabase()
): boolean {
  initializeDatabase(db);
  const result = db.prepare("DELETE FROM watched_zones WHERE id = ?").run(id);
  return result.changes > 0;
}

export function countWatchedZones(db: SqliteDatabase = getDatabase()): number {
  initializeDatabase(db);
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM watched_zones")
    .get() as { total: number };
  return row.total;
}
