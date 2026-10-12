/**
 * Utilidades geográficas compartidas (cliente y servidor).
 * La geolocalización del usuario, si se usa, se calcula en el navegador
 * y nunca se persiste ni se envía al servidor.
 */

export type LatLng = {
  latitude: number;
  longitude: number;
};

function assertValidCoord({ latitude, longitude }: LatLng, label: string): void {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      `Coordenadas inválidas en ${label}: latitud ${latitude}, longitud ${longitude}`
    );
  }
}

/**
 * Distancia en kilómetros entre dos puntos (fórmula haversine,
 * radio terrestre medio 6371 km).
 */
export function distanceKm(from: LatLng, to: LatLng): number {
  assertValidCoord(from, "from");
  assertValidCoord(to, "to");

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

/** `true` si `to` está dentro de `radiusKm` respecto a `from`. */
export function isWithinRadius(
  from: LatLng,
  to: LatLng,
  radiusKm: number
): boolean {
  if (!Number.isFinite(radiusKm) || radiusKm < 0) {
    throw new Error(`Radio inválido: ${radiusKm}`);
  }
  return distanceKm(from, to) <= radiusKm;
}
