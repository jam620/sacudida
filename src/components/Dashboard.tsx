"use client";

/**
 * Dashboard principal (cliente): banner de alerta, contador de réplicas,
 * último sismo, estadísticas, seguridad rápida, filtros, mapa, lista y
 * acciones (sincronización, ubicación opcional, avisos con umbral,
 * sonido y vibración).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AftershockChart from "./AftershockChart";
import AftershockCounter from "./AftershockCounter";
import AlertBanner from "./AlertBanner";
import EarthquakeList from "./EarthquakeList";
import EewDemo from "./EewDemo";
import Filters from "./Filters";
import LatestEarthquakeCard from "./LatestEarthquakeCard";
import MapView from "./MapView";
import NoticeLabels from "./NoticeLabels";
import QuickSafetyStrip from "./QuickSafetyStrip";
import StatsPanel from "./StatsPanel";
import WatchedZones from "./WatchedZones";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useSettings } from "@/hooks/useSettings";
import { useUserLocation } from "@/hooks/useUserLocation";
import {
  DEFAULT_DAYS,
  DEFAULT_MIN_MAGNITUDE,
  DEFAULT_ORDER_BY,
  HIGH_IMPACT_MAGNITUDE,
  NOTIFICATION_THRESHOLDS,
  POLL_INTERVAL_MS,
  RELEVANT_MAGNITUDE,
} from "@/lib/constants";
import { formatPanamaDateTime } from "@/lib/format";
import {
  notificationPermission,
  notificationsSupported,
  notifyRelevantEarthquake,
  requestNotificationPermission,
} from "@/lib/notifications";
import { playAlertSound } from "@/lib/sound";
import { NOTICE_DISCLAIMER } from "@/lib/noticeLabels";
import type { Earthquake, EarthquakeFilters } from "@/types/earthquake";

/** Evento más reciente por encima de una magnitud dada. */
function mostRecentAbove(
  earthquakes: Earthquake[],
  threshold: number
): Earthquake | null {
  let best: Earthquake | null = null;
  for (const earthquake of earthquakes) {
    if (
      earthquake.magnitude >= threshold &&
      (best === null || earthquake.time > best.time)
    ) {
      best = earthquake;
    }
  }
  return best;
}

function mostRecent(earthquakes: Earthquake[]): Earthquake | null {
  let best: Earthquake | null = null;
  for (const earthquake of earthquakes) {
    if (best === null || earthquake.time > best.time) {
      best = earthquake;
    }
  }
  return best;
}

const VIBRATE_STORAGE_KEY = "sacudida.vibrate";
const SOUND_STORAGE_KEY = "sacudida.sound";

export default function Dashboard() {
  const [filters, setFilters] = useState<EarthquakeFilters>({
    minMagnitude: DEFAULT_MIN_MAGNITUDE,
    days: DEFAULT_DAYS,
    orderBy: DEFAULT_ORDER_BY,
  });
  const filtersTouched = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notifyThreshold, setNotifyThreshold] = useState<number>(
    RELEVANT_MAGNITUDE
  );
  const [vibrateEnabled, setVibrateEnabled] = useState(false);
  const [vibrateSupported, setVibrateSupported] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastNotifiedId = useRef<string | null>(null);

  const { settings } = useSettings();
  const {
    earthquakes,
    count,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useEarthquakes(filters);
  const {
    coords,
    status: locationStatus,
    error: locationError,
    request: requestLocation,
    clear: clearLocation,
  } = useUserLocation();

  // Sembrar filtros y umbral de avisos con las preferencias guardadas.
  useEffect(() => {
    if (settings && !filtersTouched.current) {
      setFilters({
        minMagnitude: settings.minMagnitude,
        days: settings.days,
        orderBy: settings.orderBy,
      });
      setNotifyThreshold(settings.notifyMinMagnitude);
    }
  }, [settings]);

  useEffect(() => {
    if (earthquakes) {
      setLastUpdatedAt(Date.now());
    }
  }, [earthquakes]);

  // Soporte de vibración y preferencias recordadas (solo en el dispositivo).
  useEffect(() => {
    setVibrateSupported(
      typeof navigator !== "undefined" && "vibrate" in navigator
    );
    try {
      if (window.localStorage.getItem(VIBRATE_STORAGE_KEY) === "1") {
        setVibrateEnabled(true);
      }
      if (window.localStorage.getItem(SOUND_STORAGE_KEY) === "0") {
        setSoundEnabled(false);
      }
    } catch {
      // Sin localStorage no se recuerda la preferencia.
    }
  }, []);

  // Reloj del indicador EN VIVO (solo con la pestaña visible).
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (document.visibilityState === "hidden") return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Aviso push abierto: preseleccionar el evento (?sismo=<id>).
  useEffect(() => {
    if (typeof window === "undefined" || earthquakes === null) return;
    const target = new URLSearchParams(window.location.search).get("sismo");
    if (target && earthquakes.some((earthquake) => earthquake.id === target)) {
      setSelectedId(target);
    }
  }, [earthquakes]);

  // Si el navegador ya tenía permiso concedido, activar avisos sin
  // notificar por datos históricos ya visibles.
  useEffect(() => {
    if (notificationsSupported() && notificationPermission() === "granted") {
      setNotificationsOn(true);
    }
  }, []);

  // Aviso de sismos nuevos por encima del umbral: notificación del
  // navegador (si se concedió), sonido (si está activado) y vibración
  // (si el dispositivo lo soporta y está activada).
  useEffect(() => {
    if (!earthquakes) {
      return;
    }
    if (lastNotifiedId.current === null) {
      lastNotifiedId.current =
        mostRecentAbove(earthquakes, notifyThreshold)?.id ?? "none";
      return;
    }
    const fresh = mostRecentAbove(earthquakes, notifyThreshold);
    if (fresh && fresh.id !== lastNotifiedId.current) {
      if (notificationsOn) {
        notifyRelevantEarthquake(fresh);
      }
      if (soundEnabled) {
        playAlertSound({ urgent: fresh.magnitude >= HIGH_IMPACT_MAGNITUDE });
      }
      if (vibrateEnabled && vibrateSupported) {
        try {
          navigator.vibrate([180, 90, 180]);
        } catch {
          // La vibración es un extra; nunca debe romper el aviso.
        }
      }
      lastNotifiedId.current = fresh.id;
    }
  }, [earthquakes, notificationsOn, notifyThreshold, soundEnabled, vibrateEnabled, vibrateSupported]);

  const handleFiltersChange = useCallback((next: EarthquakeFilters) => {
    filtersTouched.current = true;
    setFilters(next);
    setSelectedId(null);
  }, []);

  const handleThresholdChange = useCallback((threshold: number) => {
    filtersTouched.current = true;
    // Al cambiar el umbral no se avisa por eventos ya mostrados.
    lastNotifiedId.current = null;
    setNotifyThreshold(threshold);
  }, []);

  const toggleVibration = useCallback(() => {
    setVibrateEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(VIBRATE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Preferencia no persistida.
      }
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Preferencia no persistida.
      }
      // El clic habilita el audio y sirve de muestra del aviso.
      if (next) {
        playAlertSound({ urgent: false });
      }
      return next;
    });
  }, []);

  const handleSavePreferences = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...filters,
          notifyMinMagnitude: notifyThreshold,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok || (payload as { ok?: unknown }).ok !== true) {
        const message = (payload as { message?: unknown }).message;
        throw new Error(
          typeof message === "string" ? message : "No fue posible guardar."
        );
      }
      return "Preferencias guardadas.";
    } catch (saveError) {
      return saveError instanceof Error
        ? saveError.message
        : "No fue posible guardar las preferencias.";
    }
  }, [filters, notifyThreshold]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/earthquakes/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          days: filters.days,
          minMagnitude: filters.minMagnitude,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok || (payload as { ok?: unknown }).ok !== true) {
        const message = (payload as { message?: unknown }).message;
        throw new Error(
          typeof message === "string" ? message : "No fue posible sincronizar."
        );
      }

      await mutate(undefined, { revalidate: true });
    } catch (syncFailure) {
      setSyncError(
        syncFailure instanceof Error
          ? syncFailure.message
          : "No fue posible sincronizar con USGS."
      );
    } finally {
      setSyncing(false);
    }
  }, [filters, mutate]);

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsOn(granted);
    if (granted) {
      lastNotifiedId.current = null;
    }
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  /** Punto de la gráfica pulsado: seleccionar y acercar el mapa. */
  const handleChartSelect = useCallback((id: string) => {
    setSelectedId(id);
    document
      .getElementById("mapa")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const bannerEvent = earthquakes
    ? mostRecentAbove(earthquakes, RELEVANT_MAGNITUDE)
    : null;
  const latest = earthquakes ? mostRecent(earthquakes) : null;

  return (
    <section aria-label="Monitor de sismos" className="flex flex-col gap-4">
      {bannerEvent ? <AlertBanner earthquake={bannerEvent} /> : null}

      <AftershockCounter />

      <AftershockChart
        earthquakes={earthquakes ?? []}
        selectedId={selectedId}
        onSelect={handleChartSelect}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <LatestEarthquakeCard earthquake={latest} />
        <StatsPanel earthquakes={earthquakes ?? []} />
      </div>

      <QuickSafetyStrip />

      <WatchedZones />

      <EewDemo />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <Filters
          filters={filters}
          onChange={handleFiltersChange}
          onSavePreferences={handleSavePreferences}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4 text-sm">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? "Sincronizando…" : "Sincronizar ahora"}
          </button>

          {coords === null ? (
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === "requesting"}
              className="rounded-lg border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locationStatus === "requesting"
                ? "Obteniendo ubicación…"
                : "Usar mi ubicación (opcional)"}
            </button>
          ) : (
            <button
              type="button"
              onClick={clearLocation}
              className="rounded-lg border border-emerald-600/60 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              Dejar de usar mi ubicación
            </button>
          )}

          {!notificationsOn ? (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="rounded-lg border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
            >
              Activar avisos
            </button>
          ) : (
            <span className="rounded-lg border border-emerald-600/60 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              Avisos activados en este navegador
            </span>
          )}

          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">
              Magnitud mínima para los avisos
            </legend>
            <span id="threshold-label" className="text-xs text-slate-400">
              Avisar desde
            </span>
            <div
              role="radiogroup"
              aria-labelledby="threshold-label"
              className="flex overflow-hidden rounded-lg border border-slate-700"
            >
              {NOTIFICATION_THRESHOLDS.map((threshold) => (
                <button
                  key={threshold}
                  type="button"
                  role="radio"
                  aria-checked={notifyThreshold === threshold}
                  onClick={() => handleThresholdChange(threshold)}
                  className={`px-2.5 py-1.5 text-xs font-semibold ${
                    notifyThreshold === threshold
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  M {threshold}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={toggleSound}
              className="h-4 w-4 accent-sky-500"
              aria-label="Sonido al recibir un sismo nuevo"
            />
            🔊 Sonido
          </label>

          {vibrateSupported ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={vibrateEnabled}
                onChange={toggleVibration}
                className="h-4 w-4 accent-sky-500"
              />
              Vibrar al avisar
            </label>
          ) : null}

          {(locationStatus === "denied" || locationStatus === "error") &&
          locationError ? (
            <span role="status" className="text-xs text-amber-300">
              {locationError} La distancia a tu ubicación no se mostrará.
            </span>
          ) : null}

          {coords !== null ? (
            <span className="text-xs text-slate-400">
              Tu ubicación se usa solo en este navegador para calcular
              distancias; nunca se envía al servidor ni se guarda.
            </span>
          ) : null}
        </div>
      </div>

      <div id="mapa" className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <MapView
          earthquakes={earthquakes ?? []}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <EarthquakeList
          earthquakes={earthquakes}
          count={count}
          isLoading={isLoading}
          isValidating={isValidating}
          error={error}
          minMagnitude={filters.minMagnitude}
          onRetry={() => void mutate()}
          onSync={handleSync}
          syncing={syncing}
          syncError={syncError}
          selectedId={selectedId}
          onSelect={handleSelect}
          userLocation={coords}
        />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500" aria-live="polite">
        {isValidating ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400"
            />
            EN VIVO · buscando novedades
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-emerald-400"
            />
            EN VIVO
          </span>
        )}
        <span>
          Actualización automática cada {POLL_INTERVAL_MS / 1000} s
          {lastUpdatedAt !== null
            ? ` · últimos datos hace ${Math.max(0, Math.round((nowTick - lastUpdatedAt) / 1000))} s`
            : ""}
          {lastUpdatedAt !== null
            ? ` (${formatPanamaDateTime(lastUpdatedAt)} hora de Panamá)`
            : ""}
          .
        </span>
      </p>

      <NoticeLabels />

      <p className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200">
        {NOTICE_DISCLAIMER} Los avisos de Sacudida se generan después de que
        la fuente publica el evento y pueden tardar minutos; no son alerta
        temprana. Ante una emergencia real sigue a SINAPROC y llama al 911.
      </p>
    </section>
  );
}
