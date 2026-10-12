/**
 * Script CLI: `npm run db:init`
 * Crea (si no existe) la base de datos y aplica el schema.
 */

import { closeDatabase, getDatabase } from "./client";
import { initializeDatabase } from "./migrations";
import { loadEnvLocal } from "../env";

async function main(): Promise<void> {
  loadEnvLocal();

  try {
    const db = getDatabase();
    initializeDatabase(db);
    const databasePath = process.env.DATABASE_PATH ?? "./data/sacudida.sqlite";
    console.log(`Base de datos inicializada correctamente: ${databasePath}`);
  } catch (error) {
    console.error(
      `Error al inicializar la base de datos: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
    process.exitCode = 1;
  } finally {
    closeDatabase();
  }
}

void main();
