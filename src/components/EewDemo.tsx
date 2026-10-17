"use client";

/**
 * Simulacro de alerta temprana (modo demostración).
 *
 * Muestra cómo se vería un aviso EEW real —cuenta regresiva, intensidad
 * esperada e instrucción "Agáchate, cúbrete y sujétate"— dejando claro
 * que Sacudida NO tiene alerta temprana real ni la promete. Cuando una
 * autoridad se integre (interfaz EarthquakeEarlyWarningProvider), esta
 * misma tarjeta servirá para los avisos reales.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { EEW_INSTRUCTION, SimulatedEewProvider } from "@/lib/eew";
import type { EarlyWarning } from "@/lib/eew";
import { NOTICE_DISCLAIMER } from "@/lib/noticeLabels";

export default function EewDemo() {
  const [warning, setWarning] = useState<EarlyWarning | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const providerRef = useRef<SimulatedEewProvider | null>(null);

  useEffect(() => {
    const provider = new SimulatedEewProvider();
    providerRef.current = provider;
    const unsubscribe = provider.onWarning((incoming) => {
      setWarning(incoming);
      setRemaining(incoming.etaSeconds);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (remaining === null || remaining <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const startDrill = useCallback(() => {
    providerRef.current?.triggerDemoWarning();
  }, []);

  return (
    <section
      aria-labelledby="eew-titulo"
      className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4 sm:p-5"
    >
      <h2 id="eew-titulo" className="text-base font-semibold text-slate-100">
        Simulacro de alerta temprana{" "}
        <span className="rounded-md bg-violet-600/30 px-2 py-0.5 text-xs font-bold text-violet-200">
          modo demostración
        </span>
      </h2>

      {warning === null ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Una alerta temprana real avisa <strong>antes</strong> de que
            lleguen las ondas y solo puede emitirla una autoridad con red
            sísmica en tiempo real. Sacudida aún no integra ningún proveedor
            de ese tipo; los avisos que envía son posteriores a la
            publicación del sismo. Este simulacro muestra cómo se vería.
          </p>
          <button
            type="button"
            onClick={startDrill}
            className="mt-3 rounded-lg border border-violet-500/60 bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-600/30"
          >
            Iniciar simulacro (20 s)
          </button>
        </>
      ) : (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-2 rounded-lg border border-red-500/70 bg-red-950/70 p-4"
        >
          <p className="text-sm font-bold text-red-200">
            {warning.sourceLabel} · M {warning.magnitude.toFixed(1)} ·{" "}
            {warning.place}
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-white">
            {remaining !== null && remaining > 0
              ? `Llegada estimada en ${remaining} s`
              : "Ondas simuladas en tu zona"}
          </p>
          <p className="mt-1 text-sm text-red-100">
            Intensidad esperada: MMI {warning.expectedIntensityMmi} (fuerte)
          </p>
          <p className="mt-3 rounded-lg bg-red-900/60 p-3 text-base font-extrabold uppercase tracking-wide text-white">
            {EEW_INSTRUCTION}
          </p>
          <p className="mt-2 text-xs text-red-200/80">
            Es un simulacro de demostración: no hay sismo real. {NOTICE_DISCLAIMER}
          </p>
          <button
            type="button"
            onClick={() => {
              setWarning(null);
              setRemaining(null);
            }}
            className="mt-3 rounded-lg border border-red-400/60 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-900/40"
          >
            Cerrar simulacro
          </button>
        </div>
      )}
    </section>
  );
}
