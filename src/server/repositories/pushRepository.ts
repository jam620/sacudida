/**
 * Repositorio de suscripciones Web Push (`push_subscriptions`).
 * Guarda lo mínimo para enviar notificaciones: el endpoint del servicio
 * push del navegador y sus claves de cifrado. Sin datos personales.
 */

import { toIsoUtc } from "@/lib/format";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";
import type { SqliteDatabase } from "../database/client";
import type { StoredPushSubscription } from "@/types/alerts";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_min_magnitude: number;
  created_at: string;
  last_seen_at: string;
};

function mapRow(row: PushSubscriptionRow): StoredPushSubscription {
  return {
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    notifyMinMagnitude: row.notify_min_magnitude,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function upsertPushSubscription(
  input: { endpoint: string; p256dh: string; auth: string; notifyMinMagnitude?: number },
  db: SqliteDatabase = getDatabase()
): StoredPushSubscription {
  initializeDatabase(db);
  const now = toIsoUtc(Date.now());
  db.prepare(
    `
    INSERT INTO push_subscriptions
      (endpoint, p256dh, auth, notify_min_magnitude, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      notify_min_magnitude = COALESCE(excluded.notify_min_magnitude, push_subscriptions.notify_min_magnitude),
      last_seen_at = excluded.last_seen_at
    `
  ).run(
    input.endpoint,
    input.p256dh,
    input.auth,
    input.notifyMinMagnitude ?? 4.5,
    now,
    now
  );
  return listPushSubscriptions(db).find((s) => s.endpoint === input.endpoint) as StoredPushSubscription;
}

export function deletePushSubscription(
  endpoint: string,
  db: SqliteDatabase = getDatabase()
): boolean {
  initializeDatabase(db);
  const result = db
    .prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
    .run(endpoint);
  return result.changes > 0;
}

export function updatePushPreferences(
  endpoint: string,
  notifyMinMagnitude: number,
  db: SqliteDatabase = getDatabase()
): boolean {
  initializeDatabase(db);
  const result = db
    .prepare(
      "UPDATE push_subscriptions SET notify_min_magnitude = ?, last_seen_at = ? WHERE endpoint = ?"
    )
    .run(notifyMinMagnitude, toIsoUtc(Date.now()), endpoint);
  return result.changes > 0;
}

export function listPushSubscriptions(
  db: SqliteDatabase = getDatabase()
): StoredPushSubscription[] {
  initializeDatabase(db);
  const rows = db
    .prepare(
      "SELECT endpoint, p256dh, auth, notify_min_magnitude, created_at, last_seen_at FROM push_subscriptions ORDER BY created_at"
    )
    .all() as PushSubscriptionRow[];
  return rows.map(mapRow);
}

export function countPushSubscriptions(
  db: SqliteDatabase = getDatabase()
): number {
  initializeDatabase(db);
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM push_subscriptions")
    .get() as { total: number };
  return row.total;
}
