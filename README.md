# Sacudida — Sismos en Panamá

Aplicación web **informativa**, **en vivo** e **instalable (PWA)** de
monitoreo sísmico para Panamá. Consulta datos públicos de USGS, los guarda
en una caché local SQLite, los muestra en un mapa Leaflet con filtros,
incluye guía de protección civil, avisos con sonido, contador de réplicas,
balance oficial y noticias de la emergencia.

> ⚠️ **Aviso legal:** Sacudida no predice sismos, no emite alertas oficiales
> y no sustituye a SINAPROC, Protección Civil ni a los organismos oficiales
> de tsunami. Ante una emergencia real, llama al 911 y sigue las
> instrucciones de las autoridades.

## Funciones

- **Modo EN VIVO**: sondeo cada 8 s con re-sincronización continua desde
  USGS (caché vencida a los 4 s), indicador "EN VIVO · hace N s" y
  revalidación al volver a la pestaña. El límite real lo pone la
  publicación de USGS (1 a varios minutos).
- **Avisos con sonido** (🔊 sin permisos del SO, suenan con la pestaña
  abierta): tono doble para sismos nuevos sobre el umbral y tono urgente
  para M ≥ 5.5; vibración opcional y notificación del navegador.
- **Mapa** oscuro con marcadores por color/tamaño según magnitud.
- **Lista** con hora de Panamá (día/mes/año) y referencia UTC.
- **Último sismo** destacado con **lectura en voz alta** (fecha en
  palabras: "9 de octubre de 2026 a las 12:56 p. m.").
- **Contador de réplicas** desde el terremoto principal (M ≥ 6.5 en 30
  días): total, última hora y 24 h, con enlace al pronóstico OAF de USGS.
- **Noticias de la emergencia**: título, imagen y resumen agregados del
  RSS público de Google Noticias (enlace al medio original), con accesos
  a redes sociales (X / Instagram, cuentas y búsquedas en vivo).
- **Balance oficial** (fallecidos, heridos, desaparecidos y daños) según
  SINAPROC/ministerios — actualización manual en
  `src/lib/officialBalance.ts`.
- **Fuentes confiables**: gobierno (SINAPROC, IGC-UP, MEDUCA, MOP, MIVIOT,
  MIDES) y prensa panameña.
- **Accesibilidad**: tema oscuro, teclado, ARIA, tamaño de letra A/A+/A++.
- **Llamada rápida al 911** y strip "Si vuelve a temblar".
- **PWA instalable** con funcionamiento offline de los últimos datos.
- **Fail-safe**: si USGS falla, se conserva y muestra el último conjunto
  válido de datos.

## Stack

Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS 4 · SWR ·
Leaflet + react-leaflet · SQLite (better-sqlite3) · Zod · Vitest (123
pruebas).

## Puesta en marcha local

Requisitos: Node.js ≥ 20 y npm ≥ 10.

```bash
npm install
npm run db:init     # crea ./data/sacudida.sqlite (idempotente)
npm run sync        # importa eventos reales de USGS
npm run dev         # http://localhost:3000
```

> En producción local (`npm run build && npm run start`) el service worker
> queda activo: la app es instalable y sirve los últimos datos sin
> conexión. En `npm run dev` el SW no se registra.

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` / `build` / `start` | Desarrollo y producción |
| `npm run lint` / `typecheck` | Calidad |
| `npm run test` (`test:watch`, `test:coverage`) | Vitest (123 pruebas) |
| `npm run db:init` / `npm run sync` | Base y sincronización manual |
| `node scripts/generate-icons.mjs` | Regenera iconos PWA |

## Despliegue en Vercel

1. Sube el repositorio y impórtalo en Vercel (Next.js se detecta solo).
2. Despliega. Vercel detecta `VERCEL` y usa `/tmp/sacudida.sqlite`
   automáticamente; la caché efímera se repuebla sola desde USGS.
   `better-sqlite3` funciona en runtime Node.js (no Edge).
3. Variable opcional: `DISABLE_AUTO_SYNC=1` para poblar solo con
   `POST /api/earthquakes/sync`.

### Instalación en el teléfono

- **Android (Chrome/Edge)**: botón **⬇ Instalar app** o menú → "Instalar
  aplicación".
- **iOS (Safari 16.4+)**: Compartir → "Añadir a pantalla de inicio".

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/earthquakes?minMagnitude=&days=&orderBy=` | Lista filtrada (máx. 100) |
| GET | `/api/earthquakes/stats` | Réplicas de la secuencia + lastSyncAt |
| GET | `/api/earthquakes/[id]` | Detalle por ID de USGS |
| POST | `/api/earthquakes/sync` | Sincroniza desde USGS |
| GET | `/api/news` | Noticias RSS (caché 5 min) |
| GET | `/api/health` | Estado de la app y la base |
| GET / PUT | `/api/settings` | Preferencias (filtros + umbral de avisos) |

Errores: 400 inválido · 404 inexistente · 502 USGS · 500 interno; sin
stack traces.

## Cómo se mantienen los datos (modo en vivo)

- La UI sondea cada **8 s**; cada consulta re-sincroniza si la caché tiene
  más de **4 s**. Fail-safe con backoff de 15 s tras fallos y
  deduplicación de peticiones concurrentes.
- Importación: hasta **500 eventos** desde **M 2.0** (filtro por defecto
  M 2.5). Sismos M < 2.0 o solo detectados por redes locales (IGC-UP) no
  aparecen: Sacudida usa exclusivamente el feed público de USGS.
- Noticias: RSS de Google Noticias ("sismo/temblor/terremoto Panamá") con
  imagen `og:image` del artículo original (presupuesto acotado, caché
  5 min). X/Instagram no tienen APIs públicas gratuitas: se enlazan
  búsquedas en vivo y cuentas oficiales.
- La caché conserva máximo 30 días (poda automática en cada sincronización).
- Nota Vercel: cada ruta serverless tiene su `/tmp`; el `lastSyncAt` de
  `/api/earthquakes/stats` es el indicador real de frescura.

## Fuentes validadas para Panamá (2026-10-11/12)

| Fuente | Resultado |
|---|---|
| **USGS FDNWS** (en uso) | Único feed público completo para la zona; nada bajo M 4.0 en la secuencia actual. |
| GEOFON / ISC | Duplicarían eventos (IDs propios) sin añadir réplicas pequeñas. |
| IRIS FDSN | Servicio retirado. |
| RSN Costa Rica | Inaccesible; cobertura CR. |
| **IGC-UP** | Único con réplicas M 3–4; sin API pública (web y `@igcpanamaup`), enlazado en fuentes. |

## Arquitectura

```text
src/
├── app/          # página, layout, manifest PWA, offline, 8 rutas API
├── components/   # Dashboard, AftershockCounter, LatestEarthquakeCard,
│                 # StatsPanel, NewsPanel, OfficialBalance,
│                 # ReliableSources, QuickSafetyStrip, EarthquakeMap/View,
│                 # EarthquakeList/Card, Filters, AlertBanner, SafetyGuide,
│                 # InstallButton, FontSizeControl, ServiceWorkerRegistrar
├── hooks/        # useEarthquakes, useAftershockStats, useSettings,
│                 # useUserLocation
├── lib/          # constants, format (DD/MM/AAAA + fecha hablada), geo,
│                 # usgs, rss, news cache, sound (Web Audio),
│                 # notifications, officialBalance, api, errors
├── server/       # database (client/migrations/schema), etl (importer,
│                 # sync), repositories (earthquakes, settings),
│                 # services (earthquake, settings, news), http
└── types/        # earthquake, news
tests/            # 123 pruebas (fixtures USGS + RSS, sin llamadas reales)
scripts/          # generate-icons.mjs
public/           # sw.js, offline.html, icons/
```

Flujo: **USGS → Zod → SQLite (upsert idempotente + poda) → repositorio →
servicio → API → SWR → UI**; noticias: **Google Noticias RSS → parser →
og:image → caché 5 min → UI**. Almacenamiento en UTC, presentación en
`America/Panama` (día/mes/año).

## Historial del proyecto

- 2026-10-10: MVP "Sismo Panamá" (contrato CLAUDE.md/docs), rename a
  **Sacudida**, PWA, despliegue en Vercel.
- 2026-10-11: funciones inspiradas en Tiembla (último sismo, estadísticas,
  umbral de avisos, 911, accesibilidad), contador de réplicas, balance
  oficial, fuentes confiables, auto-refresco de caché.
- 2026-10-12: validación de fuentes sísmicas, modo EN VIVO, sonido,
  formato día/mes/año + fecha hablada, noticias RSS con imágenes y redes
  sociales. **El proyecto se mudó a esta carpeta (`sacudida-app`)** tras
  un incidente de visibilidad del sistema de archivos en la carpeta
  original (`sismo-panama-mvp-docs`, conservada como respaldo); toda la
  suite (123/123) y el build se verificaron desde aquí.

## Nota sobre las carpetas

La carpeta de trabajo canónica es **esta** (`sacudida-app`). La carpeta
`sismo-panama-mvp-docs` (hermana) quedó como respaldo histórico y sufrió
episodios de invisibilidad transitoria de archivos en este equipo; si se
reutilizan archivos de ahí, verificar su integridad primero.
