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
