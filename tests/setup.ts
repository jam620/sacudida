/**
 * Entorno global de pruebas (docs/08):
 * - Base de datos en memoria (sin tocar ./data).
 * - Sincronización automática desactivada: ninguna prueba debe
 *   depender de una llamada real a USGS.
 * - USGS_BASE_URL apunta a un host inalcanzable como red de seguridad
 *   adicional ante cualquier fetch sin mock.
 */

process.env.DATABASE_PATH = ":memory:";
process.env.DISABLE_AUTO_SYNC = "1";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.TZ = "UTC";
process.env.USGS_BASE_URL = "http://127.0.0.1:9/usgs";
process.env.PANAMA_LAT = "8.5";
process.env.PANAMA_LON = "-80.5";
process.env.SEARCH_RADIUS_KM = "500";
