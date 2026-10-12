"use client";

/**
 * Tarjeta "Último sismo" (inspirada en Tiembla): el evento más reciente,
 * con tiempo relativo y lectura en voz alta (speechSynthesis) para
 * accesibilidad. Solo usa datos ya cargados; sin llamadas extra.
 */

import {
  MAGNITUDE_BADGE_CLASSES,
  formatDepth,
  formatMagnitude,
  formatPanamaDateTime,
  formatPanamaDateTimeLong,
  formatRelativeTime,
  magnitudeLevel,
} from "@/lib/format";
import { APP_NAME } from "@/lib/constants";
import type { Earthquake } from "@/types/earthquake";

type LatestEarthquakeCardProps = {
  earthquake: Earthquake | null;
};

function speakLatest(earthquake: Earthquake): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();

    // Fecha en palabras: el formato numérico puede leerse mal ("12/…"
    // sonaba a diciembre) según cómo el sintetizador lo interprete.
    const utterance = new SpeechSynthesisUtterance(
      `${APP_NAME}. Último sismo: magnitud ${formatMagnitude(
        earthquake.magnitude
      )}, ${earthquake.place}, ${formatPanamaDateTimeLong(
        earthquake.time
      )}, hora de Panamá, profundidad ${Math.round(
        earthquake.depthKm
      )} kilómetros.`
    );
    utterance.lang = "es-PA";
    utterance.rate = 1;
    synthesis.speak(utterance);
  } catch {
    // Si la síntesis de voz no está disponible, la tarjeta sigue usable.
  }
}

export default function LatestEarthquakeCard({
  earthquake,
}: LatestEarthquakeCardProps) {
  if (earthquake === null) {
    return null;
  }

  const level = magnitudeLevel(earthquake.magnitude);
  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <article
      aria-label="Último sismo"
      className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500"
          />
          Último sismo · {formatRelativeTime(earthquake.time)}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-2xl font-bold ring-1 ring-inset ${MAGNITUDE_BADGE_CLASSES[level]}`}
          >
            M {formatMagnitude(earthquake.magnitude)}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
            {earthquake.place}
          </p>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {formatPanamaDateTime(earthquake.time)} (hora de Panamá) ·{" "}
          {formatDepth(earthquake.depthKm)} · fuente {earthquake.source} ·{" "}
          {earthquake.status === "reviewed" ? "revisado" : earthquake.status}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {speechSupported ? (
          <button
            type="button"
            onClick={() => speakLatest(earthquake)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            🔊 Escuchar
          </button>
        ) : null}
        <a
          href={earthquake.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sky-400 underline decoration-sky-600 underline-offset-2 hover:text-sky-300"
        >
          Ver en USGS ↗
        </a>
      </div>
    </article>
  );
}
