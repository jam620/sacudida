/**
 * Balance oficial de la emergencia (fallecidos, heridos, desaparecidos y
 * daños), según cifras difundidas por SINAPROC y ministerios.
 *
 * ⚠️ Contenido curado manualmente en `src/lib/officialBalance.ts` con
 * fecha de corte y fuente por cifra; NO proviene de un feed automático.
 * La UI muestra siempre la fecha del balance y el enlace de verificación.
 */

import { OFFICIAL_BALANCE } from "@/lib/officialBalance";
import { formatPanamaDateTime } from "@/lib/format";

export default function OfficialBalance() {
  const updatedAt = Date.parse(OFFICIAL_BALANCE.updatedAtUtc);

  return (
    <section
      aria-labelledby="balance-oficial-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
    >
      <h2
        id="balance-oficial-titulo"
        className="text-xl font-bold text-slate-100"
      >
        Balance oficial
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {Number.isFinite(updatedAt)
          ? `Cifras al ${formatPanamaDateTime(updatedAt)} (hora de Panamá)`
          : "Cifras oficiales"}{" "}
        · {OFFICIAL_BALANCE.reportedBy}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OFFICIAL_BALANCE.figures.map((figure) => (
          <div
            key={figure.id}
            className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-center"
          >
            <dd className="text-2xl font-bold tabular-nums text-slate-100">
              {figure.value}
            </dd>
            <dt className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              {figure.label}
            </dt>
            <a
              href={figure.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[11px] text-sky-400 underline decoration-sky-700 underline-offset-2 hover:text-sky-300"
            >
              {figure.sourceLabel} ↗
            </a>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-amber-300/90">
        Cifras oficiales recopiladas manualmente el 10 de octubre de 2026;
        pueden quedar desactualizadas. Verifica novedades en{" "}
        <a
          href={OFFICIAL_BALANCE.verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          {OFFICIAL_BALANCE.verificationLabel}
        </a>{" "}
        o llama al 911 en una emergencia real.
      </p>
    </section>
  );
}
