# 07 — Frontend: Dashboard, Mapa y Lista

## Página principal

`src/app/page.tsx` debe contener:

1. Header con nombre y aviso legal.
2. Banner condicional para sismos M 4.5+.
3. Filtros.
4. Mapa Leaflet.
5. Lista de eventos.
6. Guía de seguridad.
7. Estado de carga y error.

## Componentes

| Componente | Responsabilidad |
|---|---|
| `EarthquakeMap` | Mapa Leaflet y marcadores |
| `EarthquakeList` | Lista con estados loading, error y vacío |
| `EarthquakeCard` | Detalle resumido de un sismo |
| `Filters` | Magnitud, periodo y orden |
| `AlertBanner` | Aviso para eventos relevantes |
| `SafetyGuide` | Instrucciones antes, durante y después |

## Reglas visuales

- Tema oscuro.
- Color por magnitud:
  - M 3+: azul claro.
  - M 4+: amarillo.
  - M 5+: naranja.
  - M 6+: rojo.
- Tamaño del marcador proporcional a magnitud.
- Mapa con altura mínima de 500 px en escritorio.
- Layout responsivo: mapa arriba en móvil, mapa + lista en escritorio.

## Reglas funcionales

- `EarthquakeMap` debe cargarse con `dynamic(..., { ssr: false })`.
- SWR refresca cada 60 segundos.
- Mientras carga una actualización, mantener los datos anteriores.
- Si no hay datos, mostrar mensaje claro.
- Si USGS o la API fallan, mostrar error sin romper el layout.
- Toda hora visible usa `America/Panama`.

## Ejemplo de hook

```ts
"use client";

import useSWR from "swr";
import type { Earthquake, EarthquakeFilters } from "@/types/earthquake";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.message ?? "Error al cargar sismos");
  }

  return data.earthquakes as Earthquake[];
};

export function useEarthquakes(filters: EarthquakeFilters) {
  const params = new URLSearchParams({
    minMagnitude: String(filters.minMagnitude),
    days: String(filters.days),
    orderBy: filters.orderBy,
  });

  return useSWR(`/api/earthquakes?${params.toString()}`, fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
}
```
