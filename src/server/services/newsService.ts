/**
 * Servicio de noticias: agrega el RSS público de Google Noticias
 * (búsquedas "sismo/temblor/terremoto Panamá") y enriquece cada titular
 * con la imagen og:image del artículo original.
 *
 * - Sin claves de API; los enlaces llevan al medio original.
 * - Caché en memoria con TTL (5 min con datos, 1 min si algo falló).
 * - Fail-safe: un feed o artículo que falle se omite sin romper nada.
 */

import {
  buildSummary,
  parseRssItems,
} from "@/lib/rss";
import type { RssItem } from "@/lib/rss";
import type { NewsItem } from "@/types/news";

const NEWS_QUERIES = ["sismo Panamá", "temblor Panamá", "terremoto Panamá"];

const FEED_TIMEOUT_MS = 8_000;
const IMAGE_TIMEOUT_MS = 4_500;
const IMAGE_BUDGET = 12;
const MAX_ITEMS = 12;
const CACHE_TTL_MS = 5 * 60_000;
const EMPTY_CACHE_TTL_MS = 60_000;

/**
 * User-Agent tipo navegador: muchos CDN responden 403 a clientes
 * desconocidos cuando se pide la página para leer og:image.
 */
const ARTICLE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SacudidaReader/0.2";

type NewsCache = { fetchedAt: number; expiresAt: number; items: NewsItem[] };

let cache: NewsCache | null = null;
let inFlight: Promise<NewsItem[]> | null = null;

function googleNewsFeedUrl(query: string): string {
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=es-419&gl=PA&ceid=PA:es-419"
  );
}

async function fetchText(
  url: string,
  timeoutMs: number,
  userAgent?: string
): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: "application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8",
      "user-agent": userAgent ?? "Sacudida/0.2 (monitor sísmico informativo)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchFeed(query: string): Promise<RssItem[]> {
  try {
    const xml = await fetchText(googleNewsFeedUrl(query), FEED_TIMEOUT_MS);
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

/** Patrones de imagen de una página, en orden de preferencia. */
const IMAGE_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  /<img[^>]+src=["'](https?:[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i,
];

/**
 * Imagen de una página de artículo (siguiendo la redirección del feed):
 * og:image → twitter:image → image_src → primera <img> de contenido.
 */
async function extractArticleImage(articleUrl: string): Promise<string | null> {
  try {
    const html = await fetchText(articleUrl, IMAGE_TIMEOUT_MS, ARTICLE_USER_AGENT);
    for (const pattern of IMAGE_PATTERNS) {
      const match = html.match(pattern);
      const url = match?.[1]?.replace(/&amp;/g, "&");
      if (url && /^https?:\/\//.test(url)) {
        return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** El sufijo " - Medio" que Google Noticias añade al título. */
function splitTitleSource(title: string): { headline: string; suffix: string | null } {
  const index = title.lastIndexOf(" - ");
  if (index > 20 && title.length - index <= 40) {
    return {
      headline: title.slice(0, index).trim(),
      suffix: title.slice(index + 3).trim(),
    };
  }
  return { headline: title, suffix: null };
}

function toNewsItem(item: RssItem): NewsItem {
  const { headline, suffix } = splitTitleSource(item.title);
  return {
    id: item.guid,
    title: headline,
    url: item.link,
    summary: buildSummary(item.descriptionHtml),
    imageUrl: null,
    source: item.sourceName ?? suffix ?? "Google Noticias",
    sourceUrl: item.sourceUrl,
    publishedAt: item.pubDateMs,
  };
}

/** Noticias agregadas, deduplicadas y ordenadas por fecha. */
export async function getNews(): Promise<{
  items: NewsItem[];
  updatedAt: number;
}> {
  if (cache !== null && Date.now() < cache.expiresAt) {
    return { items: cache.items, updatedAt: cache.fetchedAt };
  }

  inFlight ??= (async (): Promise<NewsItem[]> => {
    const feeds = await Promise.all(NEWS_QUERIES.map(fetchFeed));
    const all = feeds.flat();

    const seen = new Set<string>();
    const unique: RssItem[] = [];
    for (const item of all) {
      const key = normalizeTitle(item.title);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    unique.sort((a, b) => (b.pubDateMs ?? 0) - (a.pubDateMs ?? 0));

    const items = unique.slice(0, MAX_ITEMS).map(toNewsItem);

    // Enriquecer con imagen (og:image / twitter:image / primera img).
    await Promise.allSettled(
      items.slice(0, IMAGE_BUDGET).map(async (newsItem) => {
        newsItem.imageUrl = await extractArticleImage(newsItem.url);
      })
    );

    const ttl = items.length > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
    cache = { fetchedAt: Date.now(), expiresAt: Date.now() + ttl, items };
    return items;
  })().finally(() => {
    inFlight = null;
  });

  const items = await inFlight;
  return { items, updatedAt: Date.now() };
}

/** Solo para pruebas: olvida la caché en memoria. */
export function resetNewsCacheForTests(): void {
  cache = null;
  inFlight = null;
}
