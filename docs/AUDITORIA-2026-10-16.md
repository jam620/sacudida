# Auditoría de Sacudida — 2026-10-16

## 1. Resumen técnico real

**Stack verificado** (package.json): Next.js 15.5.27 App Router, TypeScript 5.9.3
estricto (`noUncheckedIndexedAccess`), Tailwind 4, SWR 2.5.1, Leaflet 1.9 +
react-leaflet 5, better-sqlite3 13, Zod 4, Vitest 5.0.3, despliegue en Vercel
con auto-deploy por Git. README menciona "123 pruebas"; el conteo real hoy es
**138 en 18 archivos** (deuda documental menor).

**Arquitectura**: App Router con rutas API Node runtime (better-sqlite3 en
`serverExternalPackages`), SQLite efímero en Vercel (`/tmp/sacudida.sqlite`
por instancia, repoblado desde USGS), `schema.sql` idempotente como mecanismo
de migración (CREATE TABLE IF NOT EXISTS — añadir tablas es seguro para bases
existentes). Flujo de datos: USGS FDNWS → `usgsImporter` (valida Zod,
normaliza, upsert idempotente, poda 30 días) → repositorios → servicios →
API → SWR en cliente. Auto-sync `ensureFreshData` (staleness 4 s, backoff,
guarda de concurrencia, rescate de secuencia mainshock de 35 días).

**Archivos clave**: `src/lib/usgs.ts` (cliente+normalización),
`src/server/etl/usgsImporter.ts` (ETL), `sync.ts` (script CLI, no módulo
de servidor — el objetivo lo citaba como módulo: es `npm run sync`),
`src/server/services/earthquakeService.ts` (lógica + auto-sync),
`src/lib/notifications.ts` (Notification API de página, no push),
`public/sw.js` (SW manual: API network-first, estáticos SWR, navegación
offline), `src/lib/geo.ts` (haversine ya implementado y testeado).

**Deudas técnicas detectadas**:
1. Notificaciones solo con pestaña abierta (Notification API de página; sin
   service worker push ni suscripciones persistentes).
2. Sin almacén persistente en serverless: suscripciones/zonas en SQLite
   efímero de Vercel tendrán el mismo ciclo de vida que la caché (mitigado
   con re-suscripción al abrir y dispatch en la instancia que sirve el
   sondeo; documentado como limitación).
3. Sin observabilidad: health solo reporta DB + lastSyncAt; no hay registro
   de errores por fuente ni métricas de latencia de avisos.
4. Un solo proveedor de datos (USGS); sin capa de fuentes ni dedup
   cross-source.
5. Avisos sin etiquetado diferenciado (información vs post-publicación vs
   EEW).

## 2. Matriz de cumplimiento

| Requisito | Estado | Evidencia | Brecha | Prioridad |
|---|---|---|---|---|
| Fuentes oficiales | Cumple parcialmente | USGS FDNWS único proveedor (`usgsImporter.ts`) | IGC-UP no integrado (sin API pública validado 2026-10-11); SINAPROC/OPS solo como contenido curado | P1 |
| Normalización | Cumple | `normalizeUsgsFeature` + Zod, mapeo exacto de CLAUDE.md, `raw_json` de auditoría | Falta normalizador multi-fuente | P1 |
| Deduplicación cross-source | No cumple | PK por `id` USGS; upsert idempotente | Sin criterio espacial/temporal/magnitud entre fuentes | P1 |
| Mapa | Cumple | `EarthquakeMap` + `MapView` (react-leaflet, OSM filtrado, foco al seleccionar) | — | — |
| Catálogo y filtros | Cumple | `/api/earthquakes` con filtros validados, whitelist ORDER BY, límite 100 | — | — |
| Réplicas | Cumple | `getAftershockSummary` (M≥6.5/30 d), contador, gráfica de secuencia, backfill de mainshock | — | — |
| Geolocalización | Cumple | `useUserLocation`: opcional, en navegador, nunca persistida (CLAUDE.md) | — | — |
| Zonas vigiladas | No cumple | No existe tabla/UI/lógica de radios | Todo el requisito | P0 |
| Web Push | No cumple | Solo Notification API de página (`notifications.ts`); sw.js sin handler `push` | Todo el requisito | P0 |
| Filtros de notificación | Cumple parcialmente | Umbral `notifyMinMagnitude` (4.5/5/5.5/6) en settings + UI radios | Sin filtro por radio/zona ni por suscripción push | P0 |
| Alerta temprana | No cumple | (Correcto que no la pretenda) Sin proveedor EEW ni interfaz preparada | Interfaz + proveedor demo etiquetado | P1 |
| Transparencia | Cumple | Aviso legal en README/UI, enlaces a fuentes oficiales, "no predice sismos" | Falta etiquetado por tipo de aviso en UI/notificaciones | P0 |
| Guía de emergencia | Cumple | `SafetyGuide`, strip "Si vuelve a temblar", 911, enlaces PTWC/SINAPROC | Falta instrucción EAW estándar en el flujo demo | P1 |
| PWA/offline | Cumple | manifest, SW v1 (API fail-safe, estáticos SWR, offline.html), instalable verificada | SW sin push handler | P0 |
| Observabilidad | Cumple parcialmente | `/api/health` (DB + lastSyncAt), `lastSyncAt` en stats | Sin estado por fuente, último error, métricas de latencia de avisos | P1 |
| Tests | Cumple | 138/138 (lógica, repos, endpoints, ETL, fixtures relativos) | Nuevos módulos requieren suite propia | P0 |

## 3. Backlog priorizado

**P0 — indispensable** (implementado en esta entrega):
1. Web Push real: VAPID, tabla `push_subscriptions`, endpoints
   subscribe/unsubscribe/preferences + dispatch protegido, handler en sw.js
   (v2), envío al detectar evento nuevo que cumpla filtros, manejo de
   404/410 y permisos, sonidos existentes conservados como complemento.
2. Zonas vigiladas: tabla `watched_zones`, repositorio/servicio/API/UI,
   match haversine radio+magnitud, push condicionado por zona.
3. Integración IGC-UP: adaptador desacoplado (`igcImporter.ts`) con feed
   opt-in por env (no existe API pública: documentado), normalización al
   modelo interno y dedup cross-source (tiempo+distancia+magnitud).
4. Etiquetado de avisos: tres categorías visibles + descargo
   "Sacudida no predice sismos. No es una alerta oficial." en UI y push.

**P1 — importante** (implementado en esta entrega):
5. Proveedor EEW desacoplado: interfaz `EarthquakeEarlyWarningProvider`,
   simulacro etiquetado "modo demostración" con ETA/intensidad/instrucción,
   notas para integración futura (Google AEA/IGC-UP/proveedor autorizado).
6. Observabilidad: `sync_log` y `push_log` (sourcePublishedAt, receivedAt,
   notifiedAt, latencyMs), `/api/health` extendido por fuente.
7. Pruebas nuevas: normalización IGC, dedup, haversine/radio (ya existía,
   ampliado), decisión de push, suscripción/expiración, EEW demo.

**P2 — posterior** (no implementado, documentado):
- Almacén durable para suscripciones en serverless (Turso/Neon/Upstash) —
  hoy SQLite efímero por instancia con re-suscripción al abrir.
- Scheduler externo de más frecuencia que el cron diario de Vercel Hobby
  (GitHub Actions cada 5 min provisto, requiere secrets).
- Ingesta RSS/JSON real de IGC-UP cuando exista feed público autorizado.
- Rate-limit por endpoint de suscripción; métricas agregadas por dashboard.
