-- Schema de Sacudida (contrato en CLAUDE.md).
-- Idempotente: puede ejecutarse sobre una base existente sin pérdida de datos.

CREATE TABLE IF NOT EXISTS earthquakes (
  id TEXT PRIMARY KEY,
  magnitude REAL NOT NULL,
  place TEXT,
  longitude REAL NOT NULL,
  latitude REAL NOT NULL,
  depth_km REAL NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  source TEXT NOT NULL,
  external_url TEXT NOT NULL,
  tsunami_flag INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'automatic',
  created_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_earthquakes_occurred_at
ON earthquakes (occurred_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_earthquakes_magnitude
ON earthquakes (magnitude DESC);

CREATE INDEX IF NOT EXISTS idx_earthquakes_geo
ON earthquakes (latitude, longitude);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Suscripciones Web Push (una por navegador/dispositivo).
-- Nota serverless: en Vercel la base es efímera por instancia; la app
-- re-envía la suscripción en cada apertura para mantenerla viva.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  notify_min_magnitude REAL NOT NULL DEFAULT 4.5,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- Zonas vigiladas por el usuario (hogar, trabajo…): radio + magnitud.
CREATE TABLE IF NOT EXISTS watched_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_km REAL NOT NULL,
  min_magnitude REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Observabilidad: resultado de cada sincronización por fuente.
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  imported INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

-- Observabilidad: cada intento de aviso push con su latencia.
CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  earthquake_id TEXT NOT NULL,
  source_published_at TEXT,
  received_at TEXT,
  notified_at TEXT,
  latency_ms INTEGER,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_source
ON sync_log (source, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_log_created
ON push_log (created_at DESC);
