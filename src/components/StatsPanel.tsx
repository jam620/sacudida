"use client";

/**
 * Panel de estadísticas (inspirado en Tiembla): actividad de la última
 * hora y 24 h, total del periodo y mayor evento. Cuando el mayor evento
 * es M >= 6, enlaza al pronóstico oficial de réplicas (OAF) de USGS.
 * Los conteos se calculan sobre los eventos cargados con los filtros
 * actuales; no son un balance oficial.
 */

import {
  formatMagnitude,
  formatPanamaDateTime,
  formatRelativeTime,
} from "@/lib/format";
import type { Earthquake } from "@/types/earthquake";

type StatsPanelProps = {
  earthquakes: Earthquake[];
};

/** Umbral desde el que USGS suele publicar pronóstico de réplicas (OAF). */
const OAF_MAGNITUDE_THRESHOLD = 6;

function findBiggest(earthquakes: Earthquake[]): Earthquake | null {
  let biggest: Earthquake | null = null;
  for (const earthquake of earthquakes) {
    if (
      biggest === null ||
      earthquake.magnitude > biggest.magnitude ||
      (earthquake.magnitude === biggest.magnitude &&
        earthquake.time > biggest.time)
    ) {
      biggest = earthquake;
    }
  }
  return biggest;
}

export default function StatsPanel({ earthquakes }: StatsPanelProps) {
  if (earthquakes.length === 0) {
    return null;
  }

  const now = Date.now();
  const lastHour = earthquakes.filter(
    (earthquake) => now - earthquake.time <= 3_600_000
  ).length;
  const last24h = earthquakes.filter(
    (earthquake) => now - earthquake.time <= 86_400_000
  ).length;
  const biggest = findBiggest(earthquakes);

  return (
    <section
      aria-label="Resumen de actividad sísmica"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/60 p-2">
          <p className="text-xl font-bold text-slate-100">{lastHour}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            última hora
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-2">
          <p className="text-xl font-bold text-slate-100">{last24h}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            últimas 24 h
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-2">
          <p className="text-xl font-bold text-slate-100">
            {earthquakes.length}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            en el periodo
          </p>
        </div>
      </div>

      {biggest !== null ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-300">
          <p>
            <span className="font-semibold text-slate-100">
              Mayor del periodo:
            </span>{" "}
            M {formatMagnitude(biggest.magnitude)} — {biggest.place} —{" "}
            {formatRelativeTime(biggest.time)} (
            {formatPanamaDateTime(biggest.time)} hora de Panamá)
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={biggest.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-400 underline decoration-sky-600 underline-offset-2 hover:text-sky-300"
            >
              Evento en USGS ↗
            </a>
            {biggest.magnitude >= OAF_MAGNITUDE_THRESHOLD ? (
              <a
                href={`${biggest.url}/oaf/forecast`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-300 underline decoration-amber-600 underline-offset-2 hover:text-amber-200"
              >
                Pronóstico oficial de réplicas (USGS) ↗
              </a>
            ) : null}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Conteos sobre los eventos cargados con los filtros actuales. Los
            sismos no se pueden predecir; el pronóstico de réplicas es un
            cálculo probabilístico oficial del USGS.
          </p>
        </div>
      ) : null}
    </section>
  );
}
