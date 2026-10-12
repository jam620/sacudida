# 08 — Testing

## Objetivo

Garantizar que el MVP sea estable, seguro y resistente a fallos de datos externos.

## Alcance mínimo

1. Normalización correcta de un feature USGS.
2. Rechazo de una respuesta USGS inválida.
3. Upsert idempotente en SQLite.
4. Filtros válidos e inválidos.
5. Cálculo de distancia haversine.
6. Detección de evento relevante.
7. Endpoint `/api/earthquakes` con respuesta correcta.
8. Endpoint con error controlado.
9. Verificación de que no se expongan datos sensibles ni stack traces.

## Herramientas

```bash
npm i -D vitest @vitest/coverage-v8
```

## Ejemplo: normalización

```ts
import { describe, expect, it } from "vitest";
import { normalizeUsgsFeature } from "@/lib/usgs";

describe("normalizeUsgsFeature", () => {
  it("convierte coordenadas USGS a latitud y longitud", () => {
    const feature = {
      id: "us7000abcd",
      properties: {
        mag: 4.8,
        place: "Panamá",
        time: 1760000000000,
        updated: 1760000100000,
        url: "https://earthquake.usgs.gov/test",
        net: "us",
        tsunami: 0,
        status: "reviewed",
      },
      geometry: {
        coordinates: [-80.5, 8.5, 10],
      },
    };

    const result = normalizeUsgsFeature(feature);

    expect(result.longitude).toBe(-80.5);
    expect(result.latitude).toBe(8.5);
    expect(result.depthKm).toBe(10);
    expect(result.magnitude).toBe(4.8);
  });
});
```

## Ejemplo: filtros

```ts
import { describe, expect, it } from "vitest";
import { parseFilters } from "@/server/services/earthquakeService";

describe("parseFilters", () => {
  it("aplica valores por defecto", () => {
    const filters = parseFilters({});

    expect(filters).toEqual({
      minMagnitude: 2.5,
      days: 7,
      orderBy: "time",
    });
  });

  it("rechaza periodos mayores a 30 días", () => {
    expect(() => parseFilters({ days: 90 })).toThrow();
  });
});
```

## Ejemplo: seguridad de respuesta

```ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/earthquakes/route";

describe("GET /api/earthquakes", () => {
  it("no expone stack traces", async () => {
    const response = await GET(
      new Request("http://localhost/api/earthquakes?days=999")
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).not.toContain("at ");
    expect(JSON.stringify(body)).not.toContain("node_modules");
  });
});
```

## Criterios de aceptación

- `npm run test` debe pasar.
- Cobertura mínima sugerida: 80% en `lib`, `server/services` y `server/repositories`.
- Ninguna prueba debe depender de una llamada real a USGS en CI.
- Usar mocks o fixtures para respuestas USGS.
- Toda fecha debe validarse como UTC.
- Ninguna respuesta de error debe incluir rutas locales, variables de entorno ni stack traces.
