"use client";

/**
 * Banner de "sismo relevante" (M >= 4.5, CLAUDE.md).
 * Si USGS marcó evaluación de tsunami, enlaza de forma destacada a las
 * fuentes oficiales. Se puede cerrar durante la sesión actual.
 */

import { useState } from "react";
import { HIGH_IMPACT_MAGNITUDE } from "@/lib/constants";
import {
  formatMagnitude,
  formatPanamaDateTime,
  formatRelativeTime,
} from "@/lib/format";
import { NOTICE_DISCLAIMER, NOTICE_LABELS } from "@/lib/noticeLabels";
import type { Earthquake } from "@/types/earthquake";

type AlertBannerProps = {
  earthquake: Earthquake;
};

export default function AlertBanner({ earthquake }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const highImpact = earthquake.magnitude >= HIGH_IMPACT_MAGNITUDE;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 sm:p-5 ${
        highImpact
          ? "border-red-600/70 bg-red-950/50"
          : "border-amber-600/70 bg-amber-950/40"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <p className="flex-1 text-sm font-semibold leading-relaxed sm:text-base">
          <span
            className={`mr-2 inline-block rounded-md px-2 py-0.5 font-bold ${
              highImpact
                ? "bg-red-600/30 text-red-200"
                : "bg-amber-600/30 text-amber-200"
            }`}
          >
            {highImpact ? "Alto impacto potencial" : "Sismo relevante"}
          </span>
          <span className="mr-2 inline-block rounded-md border border-slate-500/60 px-2 py-0.5 text-xs font-medium text-slate-300">
            {NOTICE_LABELS["post-event"]}
          </span>
          M {formatMagnitude(earthquake.magnitude)} — {earthquake.place} —{" "}
          {formatRelativeTime(earthquake.time)} (
          {formatPanamaDateTime(earthquake.time)} hora de Panamá)
        </p>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>

      {earthquake.tsunami ? (
        <p className="mt-3 rounded-lg border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          USGS marcó este evento para evaluación de tsunami. Consulta de
          inmediato los canales oficiales:{" "}
          <a
            href="https://www.tsunami.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            NOAA / PTWC (tsunami.gov)
          </a>{" "}
          ·{" "}
          <a
            href="https://www.sinaproc.gob.pa/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            SINAPROC
          </a>
        </p>
      ) : null}

      <p className="mt-3 text-xs text-slate-300">
        {NOTICE_DISCLAIMER} Este aviso se genera después de que la fuente
        publica el evento. Ver detalle y posibles revisiones en{" "}
        <a
          href={earthquake.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          la página oficial del evento en USGS
        </a>
        .
      </p>
    </div>
  );
}
