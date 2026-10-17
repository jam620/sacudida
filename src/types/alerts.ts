/**
 * Tipos de avisos, zonas vigiladas y suscripciones push.
 * Sin datos personales: solo coordenadas que el usuario elige guardar
 * explícitamente como zona (hogar/trabajo), nunca su ubicación en vivo.
 */

/** Suscripción Web Push persistida (una por navegador/dispositivo). */
export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  notifyMinMagnitude: number;
  createdAt: string;
  lastSeenAt: string;
};

/** Zona vigilada configurada por el usuario. */
export type WatchedZone = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  minMagnitude: number;
  active: boolean;
};

export type WatchedZoneInput = {
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  minMagnitude: number;
  active?: boolean;
};

/** Resultado del match de un evento contra las zonas vigiladas. */
export type ZoneMatch = {
  zone: WatchedZone;
  distanceKm: number;
};

/** Cuerpo del aviso push (el service worker lo muestra tal cual). */
export type EarthquakePushPayload = {
  kind: "earthquake";
  id: string;
  magnitude: number;
  place: string;
  /** Hora de Panamá preformateada en el servidor ("9 de octubre…"). */
  timeLabel: string;
  distanceLabel: string | null;
  url: string;
  appUrl: string;
  label: string;
  disclaimer: string;
};
