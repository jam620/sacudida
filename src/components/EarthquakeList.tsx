"use client";

/**
 * Lista de eventos con estados de carga, error, vacío y selección.
 * Mantiene los datos anteriores mientras carga una actualización.
 */

import EarthquakeCard from "./EarthquakeCard";
import type { LatLng } from "@/lib/geo";
import type { Earthquake } from "@/types/earthquake";

type EarthquakeListProps = {
  earthquakes: Earthquake[] | null;
  count: number;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  minMagnitude: number;
  onRetry: () => void;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation: LatLng | null;
};

export default function EarthquakeList({
  earthquakes,
  count,
  isLoading,
  isValidating,
  error,
  minMagnitude,
  onRetry,
  onSync,
  syncing,
  syncError,
  selectedId,
  onSelect,
  userLocation,
}: EarthquakeListProps) {
  if (error !== null && earthquakes === null) {
    return (
      <div
        role="alert"
        className="flex h-full min-h-[280px] flex-col items-start justify-center gap-3 rounded-xl border border-red-800 bg-red-950/40 p-5"
      >
        <h3 className="text-lg font-semibold text-red-200">
          No fue posible cargar los sismos
        </h3>
        <p className="text-sm text-red-100/90">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (isLoading && earthquakes === null) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex h-full min-h-[280px] flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <p className="text-slate-300">Cargando eventos sísmicos…</p>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border border-slate-800 bg-slate-800/50"
          />
        ))}
      </div>
    );
  }

  if (earthquakes !== null && earthquakes.length === 0) {
    return (
      <div
        role="status"
        className="flex h-full min-h-[280px] flex-col items-start justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <h3 className="text-lg font-semibold text-slate-100">
          No hay eventos que coincidan
        </h3>
        <p className="text-sm text-slate-300">
          No se encontraron sismos con magnitud mínima M{" "}
          {minMagnitude.toFixed(1)} para el periodo seleccionado. Prueba
          ampliar el periodo o bajar la magnitud, o sincroniza con USGS
          ahora.
        </p>
        {syncError ? (
          <p className="text-sm text-red-300">{syncError}</p>
        ) : null}
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? "Sincronizando…" : "Sincronizar con USGS"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-100">
          Eventos ({count})
        </h2>
        {isValidating ? (
          <span className="text-xs text-slate-400">Actualizando…</span>
        ) : null}
      </div>

      {/* min-h-0 + flex-1: sin esto el <ul> no se encoge al alto del
          contenedor (regla flex-col) y desborda miles de píxeles por
          debajo de la página con listas largas. */}
      <ul
        role="list"
        aria-label="Lista de sismos"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
      >
        {earthquakes?.map((earthquake) => (
          <li key={earthquake.id}>
            <EarthquakeCard
              earthquake={earthquake}
              selected={earthquake.id === selectedId}
              onSelect={onSelect}
              userLocation={userLocation}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
