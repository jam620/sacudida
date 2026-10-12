"use client";

/**
 * Noticias de la emergencia: título, imagen y resumen breves agregados
 * del RSS público de Google Noticias (enlaces al medio original), más
 * accesos directos a redes sociales (X / Instagram) con búsquedas en
 * vivo y cuentas oficiales verificadas.
 */

import useSWR from "swr";
import { apiFetcher } from "@/lib/api";
import { NEWS_REFRESH_INTERVAL_MS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import type { NewsResponse } from "@/types/news";

type NewsOk = Extract<NewsResponse, { ok: true }>;

const SOCIAL_LINKS = [
  {
    label: "IGC-UP en X",
    detail: "Reportes sísmicos en tiempo real de la red local.",
    url: "https://x.com/igcpanamaup",
  },
  {
    label: "X: «sismo Panamá» en vivo",
    detail: "Lo que se publica ahora mismo en X.",
    url: "https://x.com/search?q=sismo%20panam%C3%A1&f=live",
  },
  {
    label: "Instagram: #sismopanama",
    detail: "Fotos y videos de la emergencia.",
    url: "https://www.instagram.com/explore/tags/sismopanama/",
  },
  {
    label: "Instagram: #temblorpanama",
    detail: "Reportes ciudadanos del temblor.",
    url: "https://www.instagram.com/explore/tags/temblorpanama/",
  },
] as const;

function initialsOf(source: string): string {
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default function NewsPanel() {
  const { data, isLoading } = useSWR<NewsOk, Error>(
    "/api/news",
    apiFetcher<NewsOk>,
    { refreshInterval: NEWS_REFRESH_INTERVAL_MS, revalidateOnFocus: false }
  );

  const items = data?.items ?? [];

  return (
    <section
      aria-labelledby="noticias-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="noticias-titulo" className="text-xl font-bold text-slate-100">
          Noticias de la emergencia
        </h2>
        <a
          href="https://news.google.com/search?q=sismo%20panam%C3%A1&hl=es-419&gl=PA&ceid=PA:es-419"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sky-400 underline decoration-sky-700 underline-offset-2 hover:text-sky-300"
        >
          Ver todas en Google Noticias ↗
        </a>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Titulares de prensa agregados vía Google Noticias; al abrir uno vas
        al medio original. Se actualizan cada{" "}
        {NEWS_REFRESH_INTERVAL_MS / 60_000} minutos.
      </p>

      {isLoading && items.length === 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-800/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-800/40 p-4 text-sm text-slate-300">
          No fue posible cargar noticias ahora mismo. Vuelve a intentarlo en
          unos minutos o consulta directamente la sección de fuentes
          confiables.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-800/40">
                {item.imageUrl ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="block aspect-video w-full overflow-hidden bg-slate-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
                    <span className="text-3xl font-black tracking-widest text-slate-500">
                      {initialsOf(item.source) || "📰"}
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="text-sm font-semibold leading-snug text-slate-100">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-sky-300"
                    >
                      {item.title}
                    </a>
                  </h3>
                  {item.summary.length > 0 ? (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400">
                      {item.summary}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-2 text-[11px] text-slate-500">
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-400 underline decoration-slate-600 underline-offset-2"
                      >
                        {item.source}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-400">{item.source}</span>
                    )}
                    {item.publishedAt !== null
                      ? ` · ${formatRelativeTime(item.publishedAt)}`
                      : ""}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
        <h3 className="text-sm font-semibold text-slate-200">
          En redes sociales
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Búsquedas en vivo y cuentas oficiales; el contenido no pasa por
          Sacudida ni se almacena aquí.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SOCIAL_LINKS.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.detail}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
              >
                {link.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
