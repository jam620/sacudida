/**
 * GET /api/health — estado de la app: base de datos, fuentes de datos
 * (USGS e IGC-UP con su última sincronización y último error) y avisos
 * push (configuración VAPID, suscripciones y último envío con latencia).
 * 200 si la base responde; 503 si está inaccesible.
 */

import { NextResponse } from "next/server";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { LAST_SYNC_SETTING_KEY } from "@/server/etl/usgsImporter";
import { getSettingValue } from "@/server/repositories/settingsRepository";
import {
  lastPushStatus,
  lastSyncStatusBySource,
} from "@/server/repositories/observabilityRepository";
import { countPushSubscriptions } from "@/server/repositories/pushRepository";
import { countWatchedZones } from "@/server/repositories/zonesRepository";
import { isPushConfigured } from "@/server/services/pushService";

export const dynamic = "force-dynamic";

function parseIsoOrNull(value: string | null | undefined): string | null {
  return value !== null && value !== undefined && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();
    initializeDatabase(db);

    db.prepare("SELECT 1").get();

    const lastSyncAt = getSettingValue(LAST_SYNC_SETTING_KEY, db);
    const syncBySource = lastSyncStatusBySource(db);
    const usgs = syncBySource["usgs"] ?? null;
    const igcup = syncBySource["igcup"] ?? null;
    const lastPush = lastPushStatus(db);

    return NextResponse.json({
      ok: true,
      database: "ok",
      lastSyncAt: parseIsoOrNull(lastSyncAt),
      sources: {
        usgs: {
          status: usgs?.status ?? "sin-intentos",
          lastAttemptAt: usgs?.finishedAt ?? null,
          lastError: usgs?.error ?? null,
          lastImported: usgs?.imported ?? 0,
        },
        igcup: {
          status: igcup?.status ?? "not-configured",
          lastAttemptAt: igcup?.finishedAt ?? null,
          lastError: igcup?.error ?? null,
          lastImported: igcup?.imported ?? 0,
          feedConfigured: typeof process.env.IGC_UP_FEED_URL === "string",
        },
      },
      push: {
        configured: isPushConfigured(),
        subscriptions: countPushSubscriptions(db),
        lastAttempt: lastPush === null ? null : {
          status: lastPush.status,
          error: lastPush.error,
          earthquakeId: lastPush.earthquakeId,
          sourcePublishedAt: lastPush.sourcePublishedAt,
          receivedAt: lastPush.receivedAt,
          notifiedAt: lastPush.notifiedAt,
          latencyMs: lastPush.latencyMs,
        },
      },
      zones: countWatchedZones(db),
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
