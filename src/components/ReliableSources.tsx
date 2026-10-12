/**
 * Sección de fuentes confiables: instituciones de gobierno y prensa
 * panameña para seguir la emergencia. Enlaces a portales principales
 * (los enlaces profundos caducan); los avisos oficiales priman.
 */

import { GOVERNMENT_SOURCES, NEWS_SOURCES } from "@/lib/constants";

export default function ReliableSources() {
  return (
    <section
      aria-labelledby="fuentes-confiables-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
    >
      <h2
        id="fuentes-confiables-titulo"
        className="text-xl font-bold text-slate-100"
      >
        Fuentes confiables
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Instituciones del Estado y prensa establecida para seguir la
        emergencia. Ante decisiones importantes, confirma siempre con los
        canales oficiales.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Gobierno
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {GOVERNMENT_SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-200 underline decoration-slate-600 underline-offset-2 hover:text-white"
                >
                  {source.label} ↗
                </a>
                <p className="text-xs text-slate-500">{source.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            Prensa
          </h3>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {NEWS_SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-200 underline decoration-slate-600 underline-offset-2 hover:text-white"
                >
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
