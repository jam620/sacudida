# 05 — Earthquake Service

## Objetivo

Contener la lógica de negocio: validación de filtros, normalización, cálculo de relevancia, distancia y preparación de datos para la UI.

## Responsabilidades

- Validar filtros de entrada.
- Obtener eventos del repositorio.
- Calcular distancia aproximada al usuario.
- Determinar si un evento es relevante.
- Agrupar réplicas cercanas en una versión futura.
- Preparar respuestas consistentes para la API.

## Implementación

### `src/server/services/earthquakeService.ts`

```ts
import { z } from "zod";
import {
  findEarthquakeById,
  findEarthquakes,
} from "../repositories/earthquakeRepository";
import type { Earthquake, EarthquakeFilters } from "@/types/earthquake";

export const EarthquakeFiltersSchema = z.object({
  minMagnitude: z.coerce.number().min(0).max(10).default(2.5),
  days: z.coerce.number().min(1).max(30).default(7),
  orderBy: z.enum(["time", "magnitude"]).default("time"),
});

export function parseFilters(input: unknown): EarthquakeFilters {
  const result = EarthquakeFiltersSchema.safeParse(input);

  if (!result.success) {
    throw new Error("Filtros inválidos");
  }

  return result.data;
}

export function getEarthquakes(filters: EarthquakeFilters): Earthquake[] {
  return findEarthquakes(filters);
}

export function getEarthquake(id: string): Earthquake | null {
  if (!id.trim()) {
    throw new Error("ID requerido");
  }

  return findEarthquakeById(id);
}

export function isRelevant(earthquake: Earthquake): boolean {
  return earthquake.magnitude >= 4.5;
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}
```

## Reglas de relevancia

| Condición | Nivel |
|---|---|
| `magnitude >= 4.5` | Relevante |
| `magnitude >= 5.5` | Alto impacto potencial |
| `tsunami_flag = 1` | Requiere enlace destacado a fuentes oficiales |
| Distancia menor a 100 km | Prioridad local |

## Reglas

- El servicio no conoce detalles de HTTP ni SQL.
- Toda entrada externa pasa por Zod.
- La distancia se calcula con fórmula haversine.
- La geolocalización del usuario nunca se guarda por defecto.
