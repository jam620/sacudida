/**
 * Conexión SQLite centralizada (better-sqlite3).
 *
 * - Crea el directorio de la base si no existe (contrato docs/02).
 * - Mantiene una única instancia por proceso para evitar fugas de
 *   descriptores durante el hot-reload de Next.js en desarrollo.
 * - `:memory:` está reservado para pruebas.
 * - En Vercel (serverless, filesystem de solo lectura salvo /tmp) la
 *   caché vive en /tmp por instancia y se repuebla con el auto-sync.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type SqliteDatabase = Database.Database;

const DEFAULT_DATABASE_PATH = "./data/sacudida.sqlite";
export const MEMORY_DATABASE_PATH = ":memory:";

/**
 * En Vercel (funciones serverless) el sistema de archivos es de solo
 * lectura salvo /tmp: la caché SQLite vive por instancia y se repuebla
 * desde USGS gracias a la sincronización automática de arranque.
 */
const VERCEL_DATABASE_PATH = "/tmp/sacudida.sqlite";

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  return process.env.VERCEL ? VERCEL_DATABASE_PATH : DEFAULT_DATABASE_PATH;
}

type DatabaseGlobal = typeof globalThis & {
  __sismoPanamaDatabase?: SqliteDatabase;
};

const globalForDatabase = globalThis as DatabaseGlobal;

export function getDatabase(): SqliteDatabase {
  const cached = globalForDatabase.__sismoPanamaDatabase;
  if (cached) {
    return cached;
  }

  const databasePath = resolveDatabasePath();

  let db: SqliteDatabase;

  if (databasePath === MEMORY_DATABASE_PATH) {
    db = new Database(MEMORY_DATABASE_PATH);
  } else {
    try {
      fs.mkdirSync(path.dirname(path.resolve(databasePath)), {
        recursive: true,
      });
      db = new Database(databasePath);
    } catch (error) {
      throw new Error(
        `No se pudo abrir la base de datos en "${databasePath}": ${
          error instanceof Error ? error.message : "error desconocido"
        }`
      );
    }
  }

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  globalForDatabase.__sismoPanamaDatabase = db;
  return db;
}

/** Cierra la conexión activa (útil en pruebas y scripts CLI). */
export function closeDatabase(): void {
  const cached = globalForDatabase.__sismoPanamaDatabase;
  if (cached) {
    try {
      cached.close();
    } catch {
      // Si la conexión ya estaba cerrada no hay nada que hacer.
    }
    globalForDatabase.__sismoPanamaDatabase = undefined;
  }
}
