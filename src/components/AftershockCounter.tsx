"use client";

/**
 * Contador de réplicas desde el terremoto principal (inspirado en Tiembla):
 * total, actividad de la última hora y de las últimas 24 h. Se oculta
 * cuando no hay secuencia activa (M >= 6.5 en los últimos 30 días).
 * Datos 100 % USGS calculados en servidor (sin límite de 100 eventos).
 */

import { useAftershockStats } from "@/hooks/useAftershockStats";
import {
  formatMagnitude,
  formatPanamaDateTime,
  formatRelativeTime,
} from "@/lib/format";

export default function AftershockCounter() {
  const { mainshock, aftershocks } = useAftershockStats();

  if (mainshock === null || aftershocks === null) {
    return null;
  }

  return (
    <section
      aria-label="Réplicas del terremoto principal"
      className="rounded-xl border border-cyan-800/60 bg-cyan-950/30 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-4xl font-extrabold tabular-nums text-cyan-300">
          {aftershocks.total}
        </p>
        <p className="text-lg font-semibold text-slate-100">
          {aftershocks.total === 1 ? "réplica" : "réplicas"} desde el
          terremoto{" "}
          <a
            href={mainshock.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200"
          >
            M {formatMagnitude(mainshock.magnitude)}
          </a>
        </p>
        <p className="text-sm text-slate-300">
          {mainshock.place} · {formatRelativeTime(mainshock.time)} (
          {formatPanamaDateTime(mainshock.time)} hora de Panamá)
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-cyan-800/60 bg-cyan-900/30 px-3 py-1 font-medium text-cyan-200">
          Última hora: {aftershocks.lastHour}
        </span>
        <span className="rounded-full border border-cyan-800/60 bg-cyan-900/30 px-3 py-1 font-medium text-cyan-200">
          Últimas 24 h: {aftershocks.last24h}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Sismos M 2.5 o más ocurridos después del terremoto principal, según
        datos públicos de USGS. Las réplicas son normales después de un
        terremoto grande y pueden continuar durante semanas; nadie puede
        predecir cuándo ocurrirá la próxima. Las réplicas menores detectadas
        solo por la red local del IGC-UP pueden verse en su canal oficial.
      </p>
    </section>
  );
}
