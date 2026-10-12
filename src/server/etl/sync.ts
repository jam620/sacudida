/**
 * Script CLI: `npm run sync`
 * Sincroniza eventos de USGS hacia SQLite fuera del servidor web.
 * Uso: npm run sync [-- días] [-- magnitudMínima]
 */

import { importUsgsEarthquakes } from "./usgsImporter";
import { closeDatabase } from "../database/client";
import { loadEnvLocal } from "../env";

function parseArg(flag: string): number | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const days = parseArg("--dias");
  const minMagnitude = parseArg("--minmagnitud");

  const safeDays =
    days !== undefined && days >= 1 && days <= 30 ? days : undefined;
  const safeMagnitude =
    minMagnitude !== undefined && minMagnitude >= 0 && minMagnitude <= 10
      ? minMagnitude
      : undefined;

  try {
    console.log("Sincronizando con USGS…");
    const result = await importUsgsEarthquakes({
      days: safeDays,
      minMagnitude: safeMagnitude,
    });
    console.log(
      `Sincronización lista: ${result.inserted} insertados, ` +
        `${result.updated} actualizados, ${result.skipped} sin cambios y ` +
        `${result.pruned} antiguos eliminados de la caché.`
    );
  } catch (error) {
    console.error(
      `No fue posible sincronizar con USGS: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
    process.exitCode = 1;
  } finally {
    closeDatabase();
  }
}

void main();
