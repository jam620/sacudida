/**
 * Servicio de noticias: agrega el RSS público de Bing Noticias
 * (búsquedas "sismo/terremoto Panamá"), que incluye la miniatura del
 * artículo y el enlace al medio original en el propio XML. Si Bing falla
 * o no devuelve nada, se usa el RSS de Google Noticias como respaldo.
 *
 * - Sin claves de API; los enlaces llevan al medio original.
 * - Caché en memoria con TTL (5 min con datos, 1 min si algo falló).
 * - Fail-safe: un feed que falla se omite sin romper nada.
 */

import {
  buildSummary,
  parseBingNewsItems,
  parseRssItems,
} from "@/lib/rss";
import type { RssItem } from "@/lib/rss";
import type { NewsItem } from "@/types/news";

const BING_QUERIES = ["sismo Panamá", "terremoto Panamá"];
const GOOGLE_QUERIES = ["sismo Panamá", "temblor Panamá", "terremoto Panamá"];

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

function bingNewsFeedUrl(query: string): string {
  return (
    "https://www.bing.com/news/search?q=" +
    encodeURIComponent(query) +
    "&format=rss&setmkt=es-PA&setlang=es"
  );
}

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
): Promise<{ text: string; finalUrl: string }> {
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
  return { text: await response.text(), finalUrl: response.url || url };
}

async function fetchBingFeed(query: string): Promise<RssItem[]> {
  try {
    const { text } = await fetchText(bingNewsFeedUrl(query), FEED_TIMEOUT_MS);
    return parseBingNewsItems(text);
  } catch {
    return [];
  }
}

async function fetchGoogleFeed(query: string): Promise<RssItem[]> {
  try {
    const { text } = await fetchText(googleNewsFeedUrl(query), FEED_TIMEOUT_MS);
    return parseRssItems(text);
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
 * Imagen de un artículo original (no un redirect de Google Noticias):
 * og:image → twitter:image → image_src → primera <img> de contenido.
 *
 * Los enlaces de Google Noticias devuelven un intersticial propio cuyo
 * og:image es el logo genérico de Google; en ese caso se descarta y el
 * frente muestra su marcador de posición.
 */
async function extractArticleImage(articleUrl: string): Promise<string | null> {
  try {
    const { text, finalUrl } = await fetchText(
      articleUrl,
      IMAGE_TIMEOUT_MS,
      ARTICLE_USER_AGENT
    );
    if (/^https?:\/\/news\.google\.com\//i.test(finalUrl)) {
      return null;
    }
    for (const pattern of IMAGE_PATTERNS) {
      const match = text.match(pattern);
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
    imageUrl: item.imageUrl ?? null,
    source: item.sourceName ?? suffix ?? "Google Noticias",
    sourceUrl: item.sourceUrl,
    publishedAt: item.pubDateMs,
  };
}

function dedupeAndSort(items: RssItem[]): RssItem[] {
  const seen = new Set<string>();
  const unique: RssItem[] = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.sort((a, b) => (b.pubDateMs ?? 0) - (a.pubDateMs ?? 0));
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
    const bingFeeds = await Promise.all(BING_QUERIES.map(fetchBingFeed));
    let unique = dedupeAndSort(bingFeeds.flat());

    if (unique.length === 0) {
      const googleFeeds = await Promise.all(GOOGLE_QUERIES.map(fetchGoogleFeed));
      unique = dedupeAndSort(googleFeeds.flat());
    }

    const items = unique.slice(0, MAX_ITEMS).map(toNewsItem);

    // Respaldo Google: intentar la imagen del artículo original.
    await Promise.allSettled(
      items
        .filter((newsItem) => newsItem.imageUrl === null)
        .slice(0, IMAGE_BUDGET)
        .map(async (newsItem) => {
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
