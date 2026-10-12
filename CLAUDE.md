# CLAUDE.md — Contrato del proyecto Sismo Panamá MVP

## Objetivo

Construir un MVP web llamado **Sismo Panamá** para consultar actividad sísmica cercana a Panamá, visualizarla en un mapa interactivo y ofrecer orientación básica de protección civil.

La aplicación es **informativa**. No predice sismos, no emite alertas oficiales y no sustituye a SINAPROC, IGC-UP, Protección Civil ni organismos de tsunami.

## Stack obligatorio

- Next.js 14+ con App Router.
- TypeScript estricto.
- Tailwind CSS.
- SWR para fetching, caché y refresco.
- Leaflet y react-leaflet para el mapa.
- SQLite para caché local opcional del MVP.
- Vitest o Jest para pruebas unitarias.
- Playwright opcional para pruebas E2E.

## Principios

1. **Datos verificables:** todo evento debe conservar `id`, fuente, URL original, hora UTC y hora local.
2. **Trazabilidad:** ninguna transformación debe eliminar el identificador original de USGS.
3. **Fail-safe:** si USGS falla, la app debe mostrar un error claro y conservar el último conjunto válido de datos.
4. **Privacidad:** la geolocalización del usuario es opcional, se calcula en el navegador y no se persiste por defecto.
5. **Accesibilidad:** textos grandes, contraste alto, navegación por teclado y etiquetas ARIA.
6. **Responsabilidad:** los avisos de tsunami o emergencia deben enlazar siempre a fuentes oficiales.

## Modelo de datos

### Tabla `earthquakes`

| Columna | Tipo | Descripción |
|---|---|---|
| id | TEXT PRIMARY KEY | ID original de USGS |
| magnitude | REAL NOT NULL | Magnitud reportada |
| place | TEXT | Descripción de ubicación |
| longitude | REAL NOT NULL | Longitud |
| latitude | REAL NOT NULL | Latitud |
| depth_km | REAL NOT NULL | Profundidad en km |
| occurred_at_utc | TEXT NOT NULL | Fecha/hora UTC ISO 8601 |
| updated_at_utc | TEXT NOT NULL | Última actualización UTC |
| source | TEXT NOT NULL | Red o agencia, normalmente `usgs` |
| external_url | TEXT NOT NULL | URL oficial del evento |
| tsunami_flag | INTEGER NOT NULL DEFAULT 0 | 1 si USGS marca tsunami |
| review_status | TEXT NOT NULL | `automatic`, `reviewed`, `deleted` |
| created_at | TEXT NOT NULL | Fecha de inserción local |
| raw_json | TEXT | JSON original para auditoría |

### Tabla `app_settings`

| Columna | Tipo | Descripción |
|---|---|---|
| key | TEXT PRIMARY KEY | Nombre de configuración |
| value | TEXT NOT NULL | Valor serializado |
| updated_at | TEXT NOT NULL | Última modificación |

## Mapeo USGS → SQLite

| USGS GeoJSON | Columna SQLite | Transformación |
|---|---|---|
| `feature.id` | `id` | Texto directo |
| `properties.mag` | `magnitude` | `null` se convierte en `0.0` |
| `properties.place` | `place` | Texto directo o valor por defecto |
| `geometry.coordinates[0]` | `longitude` | Número |
| `geometry.coordinates[1]` | `latitude` | Número |
| `geometry.coordinates[2]` | `depth_km` | Número |
| `properties.time` | `occurred_at_utc` | Milisegundos epoch → ISO 8601 UTC |
| `properties.updated` | `updated_at_utc` | Milisegundos epoch → ISO 8601 UTC |
| `properties.net` | `source` | Normalizado a minúsculas |
| `properties.url` | `external_url` | URL directa |
| `properties.tsunami` | `tsunami_flag` | `1` si es igual a `1` |
| `properties.status` | `review_status` | Texto normalizado |
| Objeto completo | `raw_json` | JSON serializado |

## Reglas de negocio

- Radio inicial de búsqueda: 500 km desde `(8.5, -80.5)`.
- Magnitud mínima por defecto: `2.5`.
- Periodo por defecto: últimos 7 días.
- Límite inicial: 100 eventos por consulta.
- Refresco: cada 60 segundos.
- Banner de “sismo relevante” para magnitud mayor o igual a `4.5`.
- Orden disponible: más recientes o mayor magnitud.
- Hora visible al usuario: `America/Panama`.
- Hora almacenada: UTC ISO 8601.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/earthquakes` | Lista eventos filtrada |
| GET | `/api/earthquakes/[id]` | Detalle de un evento |
| POST | `/api/earthquakes/sync` | Sincroniza desde USGS hacia SQLite |
| GET | `/api/health` | Estado de la app y conexión a datos |
| GET | `/api/settings` | Preferencias de usuario |
| PUT | `/api/settings` | Actualiza preferencias de usuario |

## Estructura requerida

```text
sismo-panama-mvp/
├── CLAUDE.md
├── docs/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── server/
│   └── types/
├── tests/
└── package.json
```

## Definition of Done

- `npm run dev` inicia la aplicación sin errores.
- `npm run build` compila correctamente.
- `npm run test` pasa todas las pruebas.
- El mapa muestra eventos con color y tamaño según magnitud.
- La lista muestra hora local de Panamá, magnitud, profundidad, fuente y enlace oficial.
- Los filtros modifican correctamente la consulta.
- Un fallo de USGS no rompe la interfaz.
- No se solicita geolocalización sin consentimiento explícito.
- No se presenta la app como sistema oficial de alerta temprana.
