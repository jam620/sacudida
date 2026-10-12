/**
 * GET /api/health — estado de la app y de su conexión a datos.
 * 200 si la base responde; 503 si la base está inaccesible.
 */

import { NextResponse } from "next/server";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { LAST_SYNC_SETTING_KEY } from "@/server/etl/usgsImporter";
import { getSettingValue } from "@/server/repositories/settingsRepository";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();
    initializeDatabase(db);

    db.prepare("SELECT 1").get();

    const lastSyncAt = getSettingValue(LAST_SYNC_SETTING_KEY, db);

    return NextResponse.json({
      ok: true,
      database: "ok",
      lastSyncAt: lastSyncAt !== null && Number.isFinite(Date.parse(lastSyncAt))
        ? lastSyncAt
        : null,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      console.error(`[health] ${error.name}: ${error.message}`);
    }

    return NextResponse.json(
      {
        ok: false,
        database: "error",
        message: "La base de datos local no está disponible",
      },
      { status: 503 }
    );
  }
}
