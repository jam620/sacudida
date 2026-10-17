"use client";

/**
 * Hook de suscripción Web Push (avisos aunque la app esté cerrada).
 *
 * - El permiso solo se pide con un clic explícito del usuario.
 * - En cada apertura se re-envía la suscripción al servidor: en Vercel
 *   la base es efímera por instancia y esto la mantiene viva.
 * - Sin claves VAPID publicadas, el botón degrada con un aviso claro.
 */

import { useCallback, useEffect, useState } from "react";

const PUSH_STORAGE_KEY = "sacudida.push";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(hasPush);
    setConfigured(
      typeof process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY === "string" &&
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length > 0
    );
    if (hasPush) {
      setPermission(Notification.permission);
      try {
        setSubscribed(window.localStorage.getItem(PUSH_STORAGE_KEY) === "1");
      } catch {
        // Sin localStorage no se recuerda el estado.
      }
      // Re-alta: refresca la suscripción en el servidor al abrir la app.
      void reRegister();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(PUSH_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Preferencia no persistida.
    }
    setSubscribed(value);
  }, []);

  const reRegister = useCallback(async (): Promise<boolean> => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      Notification.permission !== "granted"
    ) {
      return false;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing === null) {
        return false;
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: existing.toJSON() }),
      });
      if (response.ok) {
        persist(true);
        return true;
      }
    } catch {
      // Silencioso: es una cura de fondo, no una acción del usuario.
    }
    return false;
  }, [persist]);

  const enable = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!supported || !configured) {
      setError(
        !supported
          ? "Este navegador no soporta avisos push."
          : "El servidor aún no tiene claves VAPID configuradas."
      );
      return false;
    }
    setBusy(true);
    try {
      let granted = Notification.permission === "granted";
      if (!granted) {
        granted = (await Notification.requestPermission()) === "granted";
        setPermission(granted ? "granted" : "denied");
      }
      if (!granted) {
        setError("Permiso de notificaciones denegado por el navegador.");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
          ),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (existing !== null) {
          await existing.unsubscribe().catch(() => undefined);
        }
        setError(payload?.message ?? "No fue posible activar los avisos push.");
        return false;
      }

      persist(true);
      return true;
    } catch {
      setError("No fue posible activar los avisos push en este dispositivo.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [configured, persist, supported]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const endpoint = existing?.endpoint;
      if (existing !== null) {
        await existing.unsubscribe();
      }
      if (endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
      }
      persist(false);
    } catch {
      persist(false);
    } finally {
      setBusy(false);
    }
  }, [persist]);

  return {
    supported,
    configured,
    permission,
    subscribed,
    busy,
    error,
    enable,
    disable,
  };
}
