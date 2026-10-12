# 02 — Database Manager

## Objetivo

Centralizar la conexión SQLite, creación del schema, migraciones y acceso seguro a la base de datos.

## Dependencia

```bash
npm i better-sqlite3
npm i -D @types/better-sqlite3
```

## Schema

### `src/server/database/schema.sql`

```sql
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
```

## Cliente

### `src/server/database/client.ts`

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath =
  process.env.DATABASE_PATH ?? "./data/sismo-panama.sqlite";

export function getDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}
```

## Inicialización

### `src/server/database/migrations.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { getDatabase } from "./client";

export function initializeDatabase(db: Database = getDatabase()): void {
  const schemaPath = path.join(
    process.cwd(),
    "src/server/database/schema.sql"
  );

  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema);
}
```

## Reglas

- Usar prepared statements siempre.
- Nunca concatenar valores de usuario en SQL.
- Las fechas se guardan en UTC ISO 8601.
- `raw_json` permite auditar el dato original.
- La base debe poder recrearse desde cero ejecutando el schema.
