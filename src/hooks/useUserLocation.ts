"use client";

/**
 * Geolocalización opcional del usuario.
 *
 * Regla de privacidad (CLAUDE.md): la ubicación se calcula en el
 * navegador, solo tras una acción explícita del usuario, se mantiene en
 * memoria de React y NUNCA se envía al servidor ni se persiste.
 */

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type UserLocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "error";

export function useUserLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("Tu navegador no soporta geolocalización.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus("granted");
      },
      (positionError) => {
        if (positionError.code === positionError.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Permiso de ubicación denegado.");
        } else {
          setStatus("error");
          setError("No fue posible obtener tu ubicación.");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      }
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { coords, status, error, request, clear };
}
