# 06 — Next.js API Routes

## Endpoints

### `GET /api/earthquakes`

Query params:

| Parámetro | Tipo | Default |
|---|---|---|
| `minMagnitude` | number | 2.5 |
| `days` | number | 7 |
| `orderBy` | `time` \| `magnitude` | `time` |

Respuesta exitosa:

```json
{
  "ok": true,
  "count": 12,
  "source": "sqlite",
  "filters": {
    "minMagnitude": 2.5,
    "days": 7,
    "orderBy": "time"
  },
  "earthquakes": []
}
```

### `GET /api/earthquakes/[id]`

Devuelve un evento o `404`.

### `POST /api/earthquakes/sync`

Ejecuta la importación desde USGS.

Respuesta:

```json
{
  "ok": true,
  "inserted": 10,
  "updated": 2,
  "skipped": 88
}
```

### `GET /api/health`

```json
{
  "ok": true,
  "database": "ok",
  "lastSyncAt": "2026-10-10T00:00:00.000Z"
}
```

## Implementación base

### `src/app/api/earthquakes/route.ts`

```ts
import { NextResponse } from "next/server";
import {
  getEarthquakes,
  parseFilters,
} from "@/server/services/earthquakeService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = parseFilters({
      minMagnitude: searchParams.get("minMagnitude"),
      days: searchParams.get("days"),
      orderBy: searchParams.get("orderBy"),
    });

    const earthquakes = getEarthquakes(filters);

    return NextResponse.json({
      ok: true,
      count: earthquakes.length,
      source: "sqlite",
      filters,
      earthquakes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error interno al consultar sismos",
      },
      { status: 400 }
    );
  }
}
```

### `src/app/api/earthquakes/sync/route.ts`

```ts
import { NextResponse } from "next/server";
import { importUsgsEarthquakes } from "@/server/etl/usgsImporter";

export async function POST() {
  try {
    const result = await importUsgsEarthquakes({
      days: 7,
      minMagnitude: 2.5,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No fue posible sincronizar con USGS",
      },
      { status: 502 }
    );
  }
}
```

## Reglas

- Todas las rutas devuelven JSON.
- Errores controlados usan `400`.
- Fallos de proveedor externo usan `502`.
- Errores internos usan `500`.
- Nunca exponer stack traces en producción.
