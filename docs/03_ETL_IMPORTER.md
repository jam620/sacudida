# 03 — ETL Importer: USGS → SQLite

## Objetivo

Descargar eventos desde USGS, validarlos, normalizarlos e insertarlos o actualizarlos en SQLite.

## URL base

```text
https://earthquake.usgs.gov/fdsnws/event/1/query
```

## Parámetros iniciales

| Parámetro | Valor |
|---|---|
| `format` | `geojson` |
| `starttime` | Fecha actual menos N días |
| `minmagnitude` | 2.5 por defecto |
| `latitude` | 8.5 |
| `longitude` | -80.5 |
| `maxradiuskm` | 500 |
| `orderby` | `time` o `magnitude` |
| `limit` | 100 |

## Mapeo

| USGS | Destino SQLite |
|---|---|
| `feature.id` | `earthquakes.id` |
| `properties.mag` | `earthquakes.magnitude` |
| `properties.place` | `earthquakes.place` |
| `geometry.coordinates[0]` | `earthquakes.longitude` |
| `geometry.coordinates[1]` | `earthquakes.latitude` |
| `geometry.coordinates[2]` | `earthquakes.depth_km` |
| `properties.time` | `earthquakes.occurred_at_utc` |
| `properties.updated` | `earthquakes.updated_at_utc` |
| `properties.net` | `earthquakes.source` |
| `properties.url` | `earthquakes.external_url` |
| `properties.tsunami` | `earthquakes.tsunami_flag` |
| `properties.status` | `earthquakes.review_status` |
| Feature completo | `earthquakes.raw_json` |

## Implementación

### `src/server/etl/usgsImporter.ts`

```ts
import { z } from "zod";
import { getDatabase } from "../database/client";
import { initializeDatabase } from "../database/migrations";

const UsgsFeatureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    updated: z.number(),
    url: z.string(),
    net: z.string(),
    tsunami: z.number(),
    status: z.string(),
  }),
  geometry: z.object({
    coordinates: z.tuple([z.number(), z.number(), z.number()]),
  }),
});

const UsgsResponseSchema = z.object({
  features: z.array(UsgsFeatureSchema),
});

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

function toIso(seconds: number): string {
  return new Date(seconds).toISOString();
}

export async function importUsgsEarthquakes(options: {
  days?: number;
  minMagnitude?: number;
}): Promise<ImportResult> {
  const days = options.days ?? 7;
  const minMagnitude = options.minMagnitude ?? 2.5;

  const starttime = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  const url = new URL(
    process.env.USGS_BASE_URL ??
      "https://earthquake.usgs.gov/fdsnws/event/1/query"
  );

  url.searchParams.set("format", "geojson");
  url.searchParams.set("starttime", starttime);
  url.searchParams.set("minmagnitude", String(minMagnitude));
  url.searchParams.set("latitude", process.env.PANAMA_LAT ?? "8.5");
  url.searchParams.set("longitude", process.env.PANAMA_LON ?? "-80.5");
  url.searchParams.set("maxradiuskm", process.env.SEARCH_RADIUS_KM ?? "500");
  url.searchParams.set("orderby", "time");
  url.searchParams.set("limit", "100");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`USGS respondió con estado ${response.status}`);
  }

  const parsed = UsgsResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("Respuesta de USGS inválida");
  }

  const db = getDatabase();
  initializeDatabase(db);

  const upsert = db.prepare(`
    INSERT INTO earthquakes (
      id, magnitude, place, longitude, latitude, depth_km,
      occurred_at_utc, updated_at_utc, source, external_url,
      tsunami_flag, review_status, created_at, raw_json
    )
    VALUES (
      @id, @magnitude, @place, @longitude, @latitude, @depth_km,
      @occurred_at_utc, @updated_at_utc, @source, @external_url,
      @tsunami_flag, @review_status, @created_at, @raw_json
    )
    ON CONFLICT(id) DO UPDATE SET
      magnitude = excluded.magnitude,
      place = excluded.place,
      longitude = excluded.longitude,
      latitude = excluded.latitude,
      depth_km = excluded.depth_km,
      occurred_at_utc = excluded.occurred_at_utc,
      updated_at_utc = excluded.updated_at_utc,
      source = excluded.source,
      external_url = excluded.external_url,
      tsunami_flag = excluded.tsunami_flag,
      review_status = excluded.review_status,
      raw_json = excluded.raw_json
  `);

  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  const insert = db.transaction(() => {
    for (const feature of parsed.data.features) {
      const [longitude, latitude, depthKm] = feature.geometry.coordinates;

      const row = {
        id: feature.id,
        magnitude: feature.properties.mag ?? 0,
        place: feature.properties.place ?? "Ubicación no disponible",
        longitude,
        latitude,
        depth_km: depthKm,
        occurred_at_utc: toIso(feature.properties.time),
        updated_at_utc: toIso(feature.properties.updated),
        source: feature.properties.net.toLowerCase(),
        external_url: feature.properties.url,
        tsunami_flag: feature.properties.tsunami === 1 ? 1 : 0,
        review_status: feature.properties.status.toLowerCase(),
        created_at: new Date().toISOString(),
        raw_json: JSON.stringify(feature),
      };

      const existing = db
        .prepare("SELECT updated_at_utc FROM earthquakes WHERE id = ?")
        .get(row.id) as { updated_at_utc: string } | undefined;

      if (!existing) {
        result.inserted += 1;
      } else if (existing.updated_at_utc !== row.updated_at_utc) {
        result.updated += 1;
      } else {
        result.skipped += 1;
      }

      upsert.run(row);
    }
  });

  insert();

  return result;
}
```

## Reglas

- Validar siempre la respuesta con Zod.
- Un evento inválido no debe detener toda la importación.
- Usar `ON CONFLICT(id) DO UPDATE` para sincronización idempotente.
- Guardar el JSON original para auditoría.
- No sobrescribir un evento si `updated_at_utc` no cambió.
