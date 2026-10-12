"use client";

/**
 * Tarjeta resumida de un sismo: magnitud, lugar, hora de Panamá (+UTC),
 * profundidad, fuente, distancia opcional y enlace oficial de USGS.
 */

import type { LatLng } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";
import {
  MAGNITUDE_BADGE_CLASSES,
  formatDepth,
  formatMagnitude,
  formatPanamaDateTime,
  formatUtcDateTime,
  magnitudeLevel,
} from "@/lib/format";
import type { Earthquake } from "@/types/earthquake";

type EarthquakeCardProps = {
  earthquake: Earthquake;
  selected: boolean;
  onSelect: (id: string) => void;
  userLocation: LatLng | null;
};

export default function EarthquakeCard({
  earthquake,
  selected,
  onSelect,
  userLocation,
}: EarthquakeCardProps) {
  const level = magnitudeLevel(earthquake.magnitude);

  let distanceLabel: string | null = null;
  if (userLocation !== null) {
    const km = distanceKm(userLocation, {
      latitude: earthquake.latitude,
      longitude: earthquake.longitude,
    });
    distanceLabel = `a ${Math.round(km)} km de tu ubicación`;
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(earthquake.id);
    }
  };

  return (
    <article
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(earthquake.id)}
      onKeyDown={handleKeyDown}
      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-500 bg-sky-950/40"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-bold ring-1 ring-inset ${MAGNITUDE_BADGE_CLASSES[level]}`}
        >
          M {formatMagnitude(earthquake.magnitude)}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
          {earthquake.place}
        </p>
        {earthquake.tsunami ? (
          <a
            href="https://www.tsunami.gov/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="rounded-md border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-300 underline decoration-red-400 underline-offset-2"
          >
            Evaluación de tsunami (fuente oficial)
          </a>
        ) : null}
      </div>

      <p className="mt-1.5 text-sm text-slate-300">
        {formatPanamaDateTime(earthquake.time)}{" "}
        <span className="text-slate-500">(hora de Panamá)</span>
      </p>
      <p className="text-xs text-slate-500">{formatUtcDateTime(earthquake.time)}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>Profundidad: {formatDepth(earthquake.depthKm)}</span>
        <span>Fuente: {earthquake.source}</span>
        <span className="capitalize">
          Estado: {earthquake.status === "reviewed" ? "revisado" : earthquake.status}
        </span>
        {distanceLabel ? (
          <span className="font-medium text-emerald-300">{distanceLabel}</span>
        ) : null}
      </div>

      <div className="mt-2">
        <a
          href={earthquake.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-medium text-sky-400 underline decoration-sky-600 underline-offset-2 hover:text-sky-300"
        >
          Ver evento en USGS ↗
        </a>
      </div>

      <span className="sr-only">Seleccionar este evento en el mapa</span>
    </article>
  );
}
