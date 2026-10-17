/**
 * Bloque de transparencia: qué significa cada tipo de aviso de Sacudida
 * (etiquetado honesto, regla crítica del producto).
 */

import { NOTICE_DISCLAIMER, NOTICE_LABELS } from "@/lib/noticeLabels";

const ITEMS: Array<{ kind: "info" | "post-event" | "eew-confirmed"; detail: string }> = [
  {
    kind: "info",
    detail:
      "Datos del catálogo (mapa, lista, fichas): sin carácter de urgencia.",
  },
  {
    kind: "post-event",
    detail:
      "Aviso push o sonido generado DESPUÉS de que USGS publica el evento: puede llegar minutos más tarde. No es alerta temprana.",
  },
  {
    kind: "eew-confirmed",
    detail:
      "Reservado a una autoridad con alerta temprana real integrada. Sacudida todavía no integra ninguna; solo ofrece un simulacro de demostración.",
  },
];

export default function NoticeLabels() {
  return (
    <section
      aria-labelledby="avisos-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
    >
      <h2 id="avisos-titulo" className="text-base font-semibold text-slate-100">
        Cómo leer los avisos de Sacudida
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-slate-300" role="list">
        {ITEMS.map((item) => (
          <li key={item.kind} className="flex flex-col gap-0.5">
            <span className="inline-flex w-fit rounded-md border border-slate-600 bg-slate-950/80 px-2 py-0.5 font-semibold text-slate-200">
              {NOTICE_LABELS[item.kind]}
            </span>
            <span className="text-slate-400">{item.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-2.5 text-xs font-semibold text-amber-200">
        {NOTICE_DISCLAIMER} Ante una emergencia real sigue a SINAPROC y llama
        al 911.
      </p>
    </section>
  );
}
