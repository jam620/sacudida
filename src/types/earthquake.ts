/**
 * Tipos de dominio de Sacudida.
 *
 * Reglas del contrato (CLAUDE.md):
 * - El identificador original de USGS nunca se pierde (`id`).
 * - Las fechas se almacenan en UTC ISO 8601; aquí se exponen como
 *   epoch en milisegundos para evitar ambigüedades de zona horaria.
 * - La UI formatea siempre a America/Panama; nunca al revés.
 */

export type OrderBy = "time" | "magnitude";

/** Evento sísmico normalizado, listo para la API y la UI. */
export type Earthquake = {
  /** ID original de USGS (por ejemplo, `us7000abcd`). */
  id: string;
  /** Magnitud reportada. USGS puede enviar `null`; se normaliza a 0. */
  magnitude: number;
  /** Descripción de ubicación provista por USGS. */
  place: string;
  longitude: number;
  latitude: number;
  /** Profundidad en kilómetros. */
  depthKm: number;
  /** Hora de ocurrencia en epoch milisegundos (UTC). */
  time: number;
  /** Última revisión de USGS en epoch milisegundos (UTC). */
  updated: number;
  /** Red o agencia que reporta el evento (normalmente `usgs`). */
  source: string;
  /** URL oficial del evento en USGS. */
  url: string;
  /** `true` si USGS marcó alerta de tsunami para el evento. */
  tsunami: boolean;
  /** `automatic`, `reviewed` o `deleted`. */
  status: string;
};

/** Filtros aceptados por la lista de eventos. */
export type EarthquakeFilters = {
  minMagnitude: number;
  days: number;
  orderBy: OrderBy;
};

/** Preferencias de usuario persistidas en `app_settings` (sin datos personales). */
export type UserPreferences = {
  minMagnitude: number;
  days: number;
  orderBy: OrderBy;
  /** Magnitud mínima para avisos de navegador (M 4.5 / 5 / 5.5 / 6). */
  notifyMinMagnitude: number;
};

/**
 * Fila de la tabla `earthquakes` (columnas en snake_case, igual que SQL).
 * `created_at` se asigna al momento de la inserción, no proviene de USGS.
 */
export type EarthquakeRow = {
  id: string;
  magnitude: number;
  place: string;
  longitude: number;
  latitude: number;
  depth_km: number;
  occurred_at_utc: string;
  updated_at_utc: string;
  source: string;
  external_url: string;
  tsunami_flag: number;
  review_status: string;
  created_at: string;
  raw_json: string;
};

/** Envelope de error estándar de todas las respuestas de la API. */
export type ApiError = {
  ok: false;
  message: string;
};

export type EarthquakesResponse =
  | {
      ok: true;
      count: number;
      source: "sqlite";
      filters: EarthquakeFilters;
      earthquakes: Earthquake[];
    }
  | ApiError;

export type EarthquakeDetailResponse =
  | { ok: true; earthquake: Earthquake }
  | ApiError;

export type SyncResponse =
  | { ok: true; inserted: number; updated: number; skipped: number; pruned: number }
  | ApiError;

export type HealthResponse =
  | { ok: true; database: "ok"; lastSyncAt: string | null }
  | { ok: false; database: "error"; message: string };

export type SettingsResponse =
  | { ok: true; settings: UserPreferences }
  | ApiError;

/** GET /api/earthquakes/stats — resumen de réplicas de la secuencia activa. */
export type AftershockStatsResponse =
  | {
      ok: true;
      mainshock: Earthquake | null;
      aftershocks: {
        total: number;
        lastHour: number;
        last24h: number;
      } | null;
      /** Última sincronización con USGS en esta instancia (ISO UTC). */
      lastSyncAt: string | null;
    }
  | ApiError;
