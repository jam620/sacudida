/**
 * Inicialización del schema. Ejecuta `schema.sql` de forma idempotente
 * (CREATE TABLE IF NOT EXISTS), por lo que puede llamarse en cada arranque.
 */

import fs from "node:fs";
import path from "node:path";
import type { SqliteDatabase } from "./client";
import { getDatabase } from "./client";

export function initializeDatabase(db: SqliteDatabase = getDatabase()): void {
  const schemaPath = path.join(
    process.cwd(),
    "src",
    "server",
    "database",
    "schema.sql"
  );

  let schema: string;

  try {
    schema = fs.readFileSync(schemaPath, "utf8");
  } catch {
    throw new Error(
      `No se pudo leer el schema de la base de datos en "${schemaPath}"`
    );
  }

  try {
    db.exec(schema);
  } catch (error) {
    throw new Error(
      `No se pudo inicializar el schema de la base de datos: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
  }
}
