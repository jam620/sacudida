/**
 * Notificaciones del navegador para sismos relevantes.
 *
 * Reglas de privacidad (CLAUDE.md):
 * - El permiso solo se solicita tras una acción explícita del usuario.
 * - No se envían datos personales al servidor para notificar.
 * - Si el navegador no soporta la API, la función degrada sin errores.
 */

import type { Earthquake } from "@/types/earthquake";
import { APP_NAME } from "./constants";
import { formatMagnitude, formatPanamaDateTimeLong } from "./format";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) {
    return "unsupported";
  }
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

/** Solicita permiso explícitamente. Resuelve `false` ante cualquier fallo. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

/** Cuerpo del aviso: magnitud, lugar y hora local de Panamá (en palabras). */
export function buildNotificationBody(earthquake: Earthquake): string {
  return (
    `M ${formatMagnitude(earthquake.magnitude)} — ${earthquake.place} — ` +
    `${formatPanamaDateTimeLong(earthquake.time)} (hora de Panamá)`
  );
}

/**
 * Muestra una notificación nativa para un sismo relevante.
 * Devuelve `true` solo si se pudo mostrar. Nunca lanza excepciones.
 */
export function notifyRelevantEarthquake(earthquake: Earthquake): boolean {
  if (!notificationsSupported()) {
    return false;
  }
  if (notificationPermission() !== "granted") {
    return false;
  }

  try {
    const notification = new Notification(
      `${APP_NAME}: sismo relevante`,
      {
        body: buildNotificationBody(earthquake),
        tag: earthquake.id,
      }
    );
    notification.onclick = () => {
      try {
        window.focus();
        window.open(earthquake.url, "_blank", "noopener,noreferrer");
      } catch {
        // El navegador puede bloquear window.open fuera del gesto del
        // usuario; la notificación ya cumplió su función informativa.
      }
    };
    return true;
  } catch {
    return false;
  }
}
