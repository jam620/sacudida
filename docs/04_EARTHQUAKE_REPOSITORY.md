# 04 — Earthquake Repository

## Objetivo

Encapsular todas las consultas SQL relacionadas con sismos.

## Interface

### `src/server/repositories/earthquakeRepository.ts`

```ts
import type { Earthquake, EarthquakeFilters } from "@/types/earthquake";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";

export function findEarthquakes(
  filters: EarthquakeFilters
): Earthquake[] {
  const db = getDatabase();
  initializeDatabase(db);

  const orderBy =
    filters.orderBy === "magnitude" ? "magnitude DESC" : "occurred_at_utc DESC";

  const rows = db
    .prepare(
      `
      SELECT *
      FROM earthquakes
      WHERE magnitude >= ?
        AND occurred_at_utc >= ?
      ORDER BY ${orderBy}
      LIMIT 100
      `
    )
    .all(
      filters.minMagnitude,
      new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
    ) as Record<string, unknown>[];

  return rows.map(mapRowToEarthquake);
}

export function findEarthquakeById(id: string): Earthquake | null {
  const db = getDatabase();
  initializeDatabase(db);

  const row = db
    .prepare("SELECT * FROM earthquakes WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  return row ? mapRowToEarthquake(row) : null;
}

function mapRowToEarthquake(row: Record<string, unknown>): Earthquake {
  return {
    id: String(row.id),
    magnitude: Number(row.magnitude),
    place: String(row.place ?? "Ubicación no disponible"),
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    depthKm: Number(row.depth_km),
    time: new Date(String(row.occurred_at_utc)).getTime(),
    updated: new Date(String(row.updated_at_utc)).getTime(),
    source: String(row.source),
    url: String(row.external_url),
    tsunami: Number(row.tsunami_flag) === 1,
    status: String(row.review_status),
  };
}
```

## Queries requeridas

| Método | Query |
|---|---|
| `findEarthquakes` | Lista filtrada por magnitud y fecha |
| `findEarthquakeById` | Evento por ID |
| `findRelevantEarthquakes` | Eventos con `magnitude >= 4.5` |
| `countEarthquakes` | Total de eventos en el periodo |
| `deleteOldEarthquakes` | Elimina eventos anteriores a N días |

## Reglas

- Ningún componente de UI debe ejecutar SQL.
- Toda consulta usa prepared statements.
- El repositorio devuelve tipos del dominio, no filas crudas de SQLite.
- Orden y límite deben estar controlados por constantes o parámetros validados.
