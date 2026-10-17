/**
 * Servicio de Web Push: envía avisos a las suscripciones cuando un evento
 * nuevo cumple los filtros (zonas vigiladas o umbral global).
 *
 * Honestidad del producto (regla crítica): estos avisos se generan
 * DESPUÉS de que la fuente publica el evento; se etiquetan como
 * "Aviso posterior a la publicación del sismo", nunca como alerta
 * temprana. Los sonidos con la pestaña abierta (lib/sound.ts) se
 * conservan como complemento.
 *
 * Fail-safe: un fallo de envío nunca rompe la sincronización; las
 * suscripciones expiradas (404/410) se eliminan solas.
 */

import webpush from "web-push";
import { NOTICE_SHORT_LABELS, NOTICE_DISCLAIMER } from "@/lib/noticeLabels";
import { distanceKm } from "@/lib/geo";
import { formatPanamaDateTimeLong, toIsoUtc } from "@/lib/format";
import type { Earthquake } from "@/types/earthquake";
import type {
  EarthquakePushPayload,
  StoredPushSubscription,
  WatchedZone,
} from "@/types/alerts";
import {
  deletePushSubscription,
  listPushSubscriptions,
} from "../repositories/pushRepository";
import { listWatchedZones } from "../repositories/zonesRepository";
import {
  hasPushBeenSent,
  logPushAttempt,
} from "../repositories/observabilityRepository";

/** ¿Hay claves VAPID configuradas en el entorno? */
export function isPushConfigured(): boolean {
  return (
    typeof process.env.VAPID_PRIVATE_KEY === "string" &&
    process.env.VAPID_PRIVATE_KEY.length > 0 &&
    typeof process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY === "string" &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length > 0
  );
}

export type PushDecision = {
  subscription: StoredPushSubscription;
  distanceLabel: string | null;
};

/**
 * Decide quién recibe el aviso por un evento (función pura):
 * - Con zonas activas: solo si el evento entra en el radio de una zona
 *   y supera la magnitud mínima de esa zona.
 * - Sin zonas configuradas: umbral global de la suscripción (para que
 *   el push no parezca roto a quien nunca definió zonas).
 */
export function decidePushRecipients(
  earthquake: Earthquake,
  subscriptions: StoredPushSubscription[],
  zones: WatchedZone[]
): PushDecision[] {
  const activeZones = zones.filter((zone) => zone.active);

  if (activeZones.length > 0) {
    const decisions: PushDecision[] = [];
    for (const subscription of subscriptions) {
      const match = activeZones
        .filter((zone) => earthquake.magnitude >= zone.minMagnitude)
        .map((zone) => ({
          zone,
          distance: distanceKm(
            { latitude: zone.latitude, longitude: zone.longitude },
            { latitude: earthquake.latitude, longitude: earthquake.longitude }
          ),
        }))
        .filter((entry) => entry.distance <= entry.zone.radiusKm)
        .sort((a, b) => a.distance - b.distance)[0];
      if (match) {
        decisions.push({
          subscription,
          distanceLabel: `a ${Math.round(match.distance)} km de ${match.zone.name}`,
        });
      }
    }
    return decisions;
  }

  return subscriptions
    .filter(
      (subscription) =>
        earthquake.magnitude >= subscription.notifyMinMagnitude
    )
    .map((subscription) => ({ subscription, distanceLabel: null }));
}

/** Cuerpo del aviso: magnitud, lugar, hora, distancia y enlaces. */
export function buildEarthquakePushPayload(
  earthquake: Earthquake,
  distanceLabel: string | null
): EarthquakePushPayload {
  return {
    kind: "earthquake",
    id: earthquake.id,
    magnitude: earthquake.magnitude,
    place: earthquake.place,
    timeLabel: formatPanamaDateTimeLong(earthquake.time),
    distanceLabel,
    url: earthquake.url,
    appUrl: `/?sismo=${encodeURIComponent(earthquake.id)}`,
    label: NOTICE_SHORT_LABELS["post-event"],
    disclaimer: NOTICE_DISCLAIMER,
  };
}

export type PushSendStatus = "sent" | "expired" | "error";

/** Envía a una suscripción; devuelve el resultado para su registro. */
export async function sendPushToSubscription(
  subscription: StoredPushSubscription,
  payload: EarthquakePushPayload,
  earthquake: Earthquake,
  receivedAtIso: string | null
): Promise<PushSendStatus> {
  const notifiedAtIso = toIsoUtc(Date.now());
  const latencyMs = notifiedAtIso !== null && earthquake.updated > 0
    ? Math.max(0, Date.now() - earthquake.updated)
    : null;
  let status: PushSendStatus = "sent";
  let error: string | null = null;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT ?? "mailto:contacto@example.org",
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
          privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
        },
        TTL: 3600,
      }
    );
  } catch (sendError) {
    const statusCode =
      typeof sendError === "object" && sendError !== null && "statusCode" in sendError
        ? Number((sendError as { statusCode?: unknown }).statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      // Suscripción caducada o cancelada: limpiar para no volver a intentar.
      status = "expired";
      deletePushSubscription(subscription.endpoint);
    } else {
      status = "error";
    }
    error =
      sendError instanceof Error ? sendError.message.slice(0, 200) : "error de envío";
  }

  try {
    logPushAttempt({
      endpoint: subscription.endpoint,
      earthquakeId: earthquake.id,
      sourcePublishedAt: earthquake.updated > 0 ? toIsoUtc(earthquake.updated) : null,
      receivedAt: receivedAtIso,
      notifiedAt: notifiedAtIso,
      latencyMs,
      status,
      error,
    });
  } catch {
    // La observabilidad nunca debe romper el envío.
  }

  return status;
}

export type DispatchResult = {
  events: number;
  sent: number;
  expired: number;
  errors: number;
  skipped: boolean;
  reason?: string;
};

/**
 * Envía los avisos push de una tanda de eventos nuevos.
 * Idempotente: no reenvía un evento ya notificado a una suscripción.
 */
export async function dispatchPushForEarthquakes(
  earthquakes: Earthquake[],
  options: { receivedAtIso?: string | null } = {}
): Promise<DispatchResult> {
  const result: DispatchResult = {
    events: earthquakes.length,
    sent: 0,
    expired: 0,
    errors: 0,
    skipped: false,
  };

  if (!isPushConfigured()) {
    return { ...result, skipped: true, reason: "vapid-no-configurado" };
  }

  const subscriptions = listPushSubscriptions();
  if (subscriptions.length === 0) {
    return { ...result, skipped: true, reason: "sin-suscripciones" };
  }
  const zones = listWatchedZones();

  const ordered = [...earthquakes].sort((a, b) => a.time - b.time);
  for (const earthquake of ordered) {
    const recipients = decidePushRecipients(earthquake, subscriptions, zones);
    for (const recipient of recipients) {
      if (hasPushBeenSent(earthquake.id, recipient.subscription.endpoint)) {
        continue;
      }
      const payload = buildEarthquakePushPayload(earthquake, recipient.distanceLabel);
      const status = await sendPushToSubscription(
        recipient.subscription,
        payload,
        earthquake,
        options.receivedAtIso ?? null
      );
      if (status === "sent") {
        result.sent += 1;
      } else if (status === "expired") {
        result.expired += 1;
      } else {
        result.errors += 1;
      }
    }
  }

  return result;
}

/** Fire-and-forget seguro: nunca rechaza (para colgar del auto-sync). */
export async function dispatchPushQuietly(
  earthquakes: Earthquake[],
  receivedAtIso?: string | null
): Promise<void> {
  try {
    await dispatchPushForEarthquakes(earthquakes, { receivedAtIso });
  } catch {
    // Un fallo de push nunca debe afectar la respuesta de datos.
  }
}
