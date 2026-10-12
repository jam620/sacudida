/**
 * Constantes de negocio de Sacudida (fuente: CLAUDE.md).
 * Ningún otro módulo debe hardcodear estos valores.
 */

export const APP_NAME = "Sacudida";

export const APP_TAGLINE = "Monitoreo de sismos en Panamá";

export const LEGAL_NOTICE =
  "Aplicación informativa y experimental. No predice sismos, no emite alertas " +
  "y no sustituye a SINAPROC, Protección Civil ni a los organismos oficiales " +
  "de tsunami. Ante una emergencia real, sigue siempre las instrucciones oficiales.";

/** Número de emergencias de Panamá (botón de llamada rápida). */
export const EMERGENCY_PHONE = "911";

/** Umbrales seleccionables para avisos de sismos relevantes. */
export const NOTIFICATION_THRESHOLDS = [4.5, 5, 5.5, 6] as const;

export const DEFAULT_MIN_MAGNITUDE = 2.5;
export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 30;
export const MIN_MAGNITUDE_LIMIT = 0;
export const MAX_MAGNITUDE_LIMIT = 10;

export type OrderBy = "time" | "magnitude";
export const DEFAULT_ORDER_BY: OrderBy = "time";

/** Límite inicial: 100 eventos por consulta (CLAUDE.md). */
export const MAX_EVENTS_PER_QUERY = 100;

/**
 * Límite de la IMPORTACIÓN desde USGS (ETL). Mayor que el límite de
 * consulta para no truncar secuencias de réplicas largas.
 */
export const SYNC_EVENTS_LIMIT = 500;

/**
 * Piso de magnitud de la sincronización automática. Se sincroniza desde
 * M 2.0 (quedan visibles si bajas el filtro) aunque el filtro por defecto
 * de consulta siga siendo 2.5 (CLAUDE.md).
 */
export const SYNC_MIN_MAGNITUDE = 2.0;

/**
 * Cadencia del modo EN VIVO (solicitado por el usuario; el contrato
 * original decía 60 s): la UI sondea cada 8 s y la caché se considera
 * vencida a los 4 s, de modo que cada sondeo trae datos recién
 * sincronizados de USGS. El límite real de "tiempo real" lo pone la
 * publicación de USGS (suele tardar de uno a varios minutos).
 */
export const POLL_INTERVAL_MS = 8_000;
export const SYNC_STALE_AFTER_MS = 4_000;

/** Refresco de la sección de noticias (RSS + imágenes), más lenta. */
export const NEWS_REFRESH_INTERVAL_MS = 5 * 60_000;

/** Banner de "sismo relevante" para magnitud >= 4.5 (CLAUDE.md). */
export const RELEVANT_MAGNITUDE = 4.5;

/** Magnitud >= 5.5 se considera de alto impacto potencial. */
export const HIGH_IMPACT_MAGNITUDE = 5.5;

/** Distancia menor a 100 km respecto al usuario: prioridad local. */
export const LOCAL_PRIORITY_DISTANCE_KM = 100;

/** Radio inicial de búsqueda: 500 km desde el centro de Panamá. */
export const PANAMA_CENTER = { latitude: 8.5, longitude: -80.5 } as const;
export const SEARCH_RADIUS_KM = 500;

export const USGS_BASE_URL_DEFAULT =
  "https://earthquake.usgs.gov/fdsnws/event/1/query";

/** Zona horaria visible para el usuario (almacenamiento siempre en UTC). */
export const TIME_ZONE = "America/Panama";

/** Timeout de llamadas al proveedor externo USGS. */
export const USGS_TIMEOUT_MS = 10_000;

/**
 * Fuentes oficiales. Todo aviso de tsunami o emergencia debe enlazar aquí.
 * No agregar fuentes no oficiales.
 */
export const OFFICIAL_LINKS = [
  {
    label: "SINAPROC (Sistema Nacional de Protección Civil de Panamá)",
    url: "https://www.sinaproc.gob.pa/",
  },
  {
    label: "USGS — Programa de Sismos (datos de origen)",
    url: "https://earthquake.usgs.gov/earthquakes/",
  },
  {
    label: "NOAA / PTWC — Centros de Alerta de Tsunami",
    url: "https://www.tsunami.gov/",
  },
] as const;

/**
 * Fuentes confiables de gobierno y prensa para seguir la emergencia.
 * Solo portales principales (los enlaces profundos caducan); el usuario
 * debe verificar siempre los canales oficiales.
 */
export const GOVERNMENT_SOURCES = [
  {
    label: "SINAPROC — Protección Civil",
    url: "https://www.sinaproc.gob.pa/",
    detail: "Avisos oficiales, albergues y balances de la emergencia.",
  },
  {
    label: "IGC-UP — Sismología (Universidad de Panamá)",
    url: "https://x.com/igcpanamaup",
    detail:
      "Reportes en tiempo real de la red sísmica local: detecta réplicas menores que USGS no publica.",
  },
  {
    label: "MEDUCA — Ministerio de Educación",
    url: "https://www.meduca.gob.pa/",
    detail: "Suspensión o reanudación de clases.",
  },
  {
    label: "MOP — Ministerio de Obras Públicas",
    url: "https://www.mop.gob.pa/",
    detail: "Estado de puentes y vías.",
  },
  {
    label: "MIVIOT — Vivienda y Ordenamiento Territorial",
    url: "https://www.miviot.gob.pa/",
    detail: "Evaluación de viviendas dañadas.",
  },
  {
    label: "MIDES — Desarrollo Social",
    url: "https://www.mides.gob.pa/",
    detail: "Ayuda humanitaria y albergues.",
  },
] as const;

export const NEWS_SOURCES = [
  { label: "TVN Noticias", url: "https://www.tvn-2.com/" },
  { label: "La Prensa", url: "https://www.prensa.com/" },
  { label: "La Estrella de Panamá", url: "https://www.laestrella.com.pa/" },
  { label: "Telemetro", url: "https://www.telemetro.com/" },
  { label: "Crítica", url: "https://www.critica.com.pa/" },
  { label: "Panamá América", url: "https://www.panamaamerica.com.pa/" },
] as const;
