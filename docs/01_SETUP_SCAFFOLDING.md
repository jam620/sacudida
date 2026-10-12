# 01 — Setup y Scaffolding

## Comandos iniciales

```bash
npx create-next-app@latest sismo-panama-mvp --typescript --tailwind --eslint --app --src-dir
cd sismo-panama-mvp

npm i leaflet react-leaflet swr better-sqlite3 zod
npm i -D @types/leaflet @types/better-sqlite3 vitest @vitest/coverage-v8
```

## Estructura

```text
sismo-panama-mvp/
├── CLAUDE.md
├── docs/
│   ├── 00_MASTER_PROMPT.md
│   ├── 01_SETUP_SCAFFOLDING.md
│   ├── 02_DATABASE_MANAGER.md
│   ├── 03_ETL_IMPORTER.md
│   ├── 04_EARTHQUAKE_REPOSITORY.md
│   ├── 05_EARTHQUAKE_SERVICE.md
│   ├── 06_NEXTJS_ROUTES.md
│   ├── 07_FRONTEND_COMPONENTS.md
│   └── 08_TESTING.md
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── earthquakes/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── earthquakes/sync/route.ts
│   │       ├── health/route.ts
│   │       └── settings/route.ts
│   ├── components/
│   │   ├── EarthquakeMap.tsx
│   │   ├── EarthquakeList.tsx
│   │   ├── EarthquakeCard.tsx
│   │   ├── Filters.tsx
│   │   ├── AlertBanner.tsx
│   │   └── SafetyGuide.tsx
│   ├── hooks/
│   │   └── useEarthquakes.ts
│   ├── lib/
│   │   ├── format.ts
│   │   ├── geo.ts
│   │   ├── notifications.ts
│   │   └── constants.ts
│   ├── server/
│   │   ├── database/
│   │   │   ├── client.ts
│   │   │   ├── schema.sql
│   │   │   └── migrations.ts
│   │   ├── etl/
│   │   │   └── usgsImporter.ts
│   │   ├── repositories/
│   │   │   └── earthquakeRepository.ts
│   │   └── services/
│   │       └── earthquakeService.ts
│   └── types/
│       └── earthquake.ts
└── tests/
```

## Scripts en `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:init": "tsx src/server/database/init.ts",
    "sync": "tsx src/server/etl/sync.ts"
  }
}
```

## Variables de entorno

`.env.local`

```env
NEXT_PUBLIC_APP_NAME="Sismo Panamá"
NEXT_PUBLIC_DEFAULT_MIN_MAGNITUDE=2.5
NEXT_PUBLIC_REFRESH_SECONDS=60
DATABASE_PATH=./data/sismo-panama.sqlite
USGS_BASE_URL=https://earthquake.usgs.gov/fdsnws/event/1/query
PANAMA_LAT=8.5
PANAMA_LON=-80.5
SEARCH_RADIUS_KM=500
```

## Reglas

- Nunca subir `data/*.sqlite` al repositorio.
- Incluir `data/` en `.gitignore`.
- La base de datos debe crearse automáticamente si no existe.
- Todas las rutas de servidor deben validar parámetros con Zod.
