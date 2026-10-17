/**
 * Repositorio de observabilidad (`sync_log`, `push_log`): estado por
 * fuente, último error y métricas de latencia de los avisos
 * (latencyMs = notifiedAt - sourcePublishedAt).
 */

import { toIsoUtc } from "@/lib/format";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";

export type SyncLogEntry = {
  source: string;
  status: string;
  error: string | null;
  imported: number;
  finishedAt: string;
};

export type PushLogEntry = {
  endpoint: string;
  earthquakeId: string;
  sourcePublishedAt: string | null;
  receivedAt: string | null;
  notifiedAt: string | null;
  latencyMs: number | null;
  status: string;
  error: string | null;
};

export function logSyncAttempt(
  entry: {
    source: string;
    status: "ok" | "error" | "not-configured";
    error?: string | null;
    imported?: number;
    startedAt?: string;
  },
  db: SqliteDatabase = getDatabase()
): void {
  initializeDatabase(db);
  const finishedAt = toIsoUtc(Date.now());
  db.prepare(
    `
    INSERT INTO sync_log (source, status, error, imported, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(
    entry.source,
    entry.status,
    entry.error ?? null,
    entry.imported ?? 0,
    entry.startedAt ?? finishedAt,
    finishedAt
  );
}

export function logPushAttempt(
  entry: PushLogEntry,
  db: SqliteDatabase = getDatabase()
): void {
  initializeDatabase(db);
  db.prepare(
    `
    INSERT INTO push_log
      (endpoint, earthquake_id, source_published_at, received_at,
       notified_at, latency_ms, status, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    entry.endpoint,
    entry.earthquakeId,
    entry.sourcePublishedAt,
    entry.receivedAt,
    entry.notifiedAt,
    entry.latencyMs,
    entry.status,
    entry.error,
    toIsoUtc(Date.now())
  );
}

/** ¿Ya se notificó este evento a esta suscripción? (idempotencia de push). */
export function hasPushBeenSent(
  earthquakeId: string,
  endpoint: string,
  db: SqliteDatabase = getDatabase()
): boolean {
  initializeDatabase(db);
  const row = db
    .prepare(
      "SELECT 1 FROM push_log WHERE earthquake_id = ? AND endpoint = ? AND status = 'sent' LIMIT 1"
    )
    .get(earthquakeId, endpoint);
  return row !== undefined;
}

/** Último registro de sincronización por fuente (para /api/health). */
export function lastSyncStatusBySource(
  db: SqliteDatabase = getDatabase()
): Record<string, SyncLogEntry> {
  initializeDatabase(db);
  const rows = db
    .prepare(
      `
      SELECT source, status, error, imported, finished_at
      FROM sync_log s
      WHERE id = (SELECT MAX(id) FROM sync_log WHERE source = s.source)
      `
    )
    .all() as Array<{
    source: string;
    status: string;
    error: string | null;
    imported: number;
    finished_at: string;
  }>;
  const map: Record<string, SyncLogEntry> = {};
  for (const row of rows) {
    map[row.source] = {
      source: row.source,
      status: row.status,
      error: row.error,
      imported: row.imported,
      finishedAt: row.finished_at,
    };
  }
  return map;
}

/** Último intento de push (estado y latencia) para /api/health. */
export function lastPushStatus(
  db: SqliteDatabase = getDatabase()
): PushLogEntry | null {
  initializeDatabase(db);
  const row = db
    .prepare(
      `
      SELECT endpoint, earthquake_id, source_published_at, received_at,
             notified_at, latency_ms, status, error
      FROM push_log ORDER BY id DESC LIMIT 1
      `
    )
    .get() as {
    endpoint: string;
    earthquake_id: string;
    source_published_at: string | null;
    received_at: string | null;
    notified_at: string | null;
    latency_ms: number | null;
    status: string;
    error: string | null;
  } | undefined;
  if (!row) {
    return null;
  }
  return {
    endpoint: row.endpoint,
    earthquakeId: row.earthquake_id,
    sourcePublishedAt: row.source_published_at,
    receivedAt: row.received_at,
    notifiedAt: row.notified_at,
    latencyMs: row.latency_ms,
    status: row.status,
    error: row.error,
  };
}
