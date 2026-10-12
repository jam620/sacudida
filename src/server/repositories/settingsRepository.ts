/**
 * Repositorio de la tabla `app_settings` (clave/valor serializado).
 * Guarda preferencias de usuario y metadatos operativos (lastSyncAt).
 * Nunca almacena datos personales ni geolocalización.
 */

import { toIsoUtc } from "@/lib/format";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";

export function getSettingValue(
  key: string,
  db: SqliteDatabase = getDatabase()
): string | null {
  initializeDatabase(db);

  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;

  return row ? row.value : null;
}

export function setSettingValue(
  key: string,
  value: string,
  db: SqliteDatabase = getDatabase()
): void {
  initializeDatabase(db);

  db.prepare(
    `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
    `
  ).run(key, value, toIsoUtc(Date.now()));
}
