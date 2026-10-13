/**
 * Parser RSS 2.0 mínimo (sin dependencias) para los feeds de noticias.
 * No es un parser XML general: cubre el subset que usan los feeds de
 * Google Noticias y es estricto con lo que devuelve.
 */

export type RssItem = {
  title: string;
  link: string;
  guid: string;
  /** Publicación en epoch milisegundos; null si no viene o es inválida. */
  pubDateMs: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  descriptionHtml: string;
  /**
   * Miniatura del artículo cuando el feed la incluye directamente
   * (Bing News la trae en <News:Image>); null en los feeds sin imagen.
   */
  imageUrl?: string | null;
};

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    );
}

function tagContent(block: string, tagName: string): string {
  const match = block.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i")
  );
  return match ? stripCdata(match[1] ?? "") : "";
}

/**
 * Elimina etiquetas HTML y deja texto plano legible.
 *
 * Importante: decodifica entidades ANTES de quitar etiquetas. Los feeds
 * traen el HTML de la descripción codificado (&lt;a href=…&gt;); si se
 * decodificara después, el enlace quedaría como texto visible.
 */
export function stripHtml(html: string): string {
  let text = decodeEntities(html);
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  // Segunda pasada por si quedó HTML doblemente codificado.
  text = decodeEntities(text);
  return text.replace(/\s+/g, " ").trim();
}

/** Resumen breve: corta en límite de palabra y añade elipsis. */
export function buildSummary(text: string, maxLength = 220): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) {
    return clean;
  }
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Extrae los <item> de un documento RSS 2.0. */
export function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.split("<item>").slice(1);
  const items: RssItem[] = [];

  for (const block of blocks) {
    const body = block.split("</item>")[0] ?? "";
    const title = decodeEntities(tagContent(body, "title"));
    const link = tagContent(body, "link");
    if (title.length === 0 || link.length === 0) {
      continue;
    }

    const pubDateRaw = tagContent(body, "pubDate");
    const pubDateMs = pubDateRaw ? Date.parse(pubDateRaw) : Number.NaN;
    const sourceMatch = body.match(
      /<source[^>]*url="([^"]+)"[^>]*>([^<]+)<\/source>/i
    );

    items.push({
      title,
      link,
      guid: tagContent(body, "guid") || link,
      pubDateMs: Number.isFinite(pubDateMs) ? pubDateMs : null,
      sourceName: sourceMatch ? decodeEntities(sourceMatch[2] ?? "").trim() : null,
      sourceUrl: sourceMatch ? sourceMatch[1] ?? null : null,
      descriptionHtml: tagContent(body, "description"),
      imageUrl: null,
    });
  }

  return items;
}

/**
 * Miniatura de un item de Bing News: la etiqueta <News:Image> apunta a un
 * redirector propio que sirve la foto real del artículo. Se fuerza HTTPS y
 * un ancho razonable; el dominio de Bing no siempre acepta http en apps.
 */
function normalizeBingImage(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }
  const https = url.replace(/^http:\/\//i, "https://");
  if (/[?&]w=/.test(https)) {
    return https;
  }
  return https.includes("?") ? `${https}&w=600` : `${https}?w=600`;
}

/**
 * URL final del medio dentro de un enlace apiclick.aspx de Bing News
 * (parámetro "url" codificado como query). Si no viene, se usa el enlace
 * tal cual: también funciona, solo que pasa por Bing.
 */
function decodeBingLink(link: string): string {
  const match = link.match(/[?&]url=([^&]+)/);
  if (!match?.[1]) {
    return link;
  }
  try {
    const decoded = decodeURIComponent(match[1]);
    return /^https?:\/\//i.test(decoded) ? decoded : link;
  } catch {
    return link;
  }
}

/**
 * Parser del RSS de Bing News (news/search?format=rss), que a diferencia
 * del de Google Noticias incluye la miniatura del artículo (<News:Image>)
 * y la URL del medio (parámetro "url" del enlace) en el propio XML.
 */
export function parseBingNewsItems(xml: string): RssItem[] {
  const blocks = xml.split("<item>").slice(1);
  const items: RssItem[] = [];

  for (const block of blocks) {
    const body = block.split("</item>")[0] ?? "";
    const title = decodeEntities(tagContent(body, "title"));
    const rawLink = decodeEntities(tagContent(body, "link"));
    if (title.length === 0 || rawLink.length === 0) {
      continue;
    }
    const link = decodeBingLink(rawLink);

    // Cierre exacto </News:Image> para no capturar <News:ImageSize>.
    const imageRaw = body.match(/<news:image>([\s\S]*?)<\/news:image>/i);
    const pubDateRaw = tagContent(body, "pubDate");
    const pubDateMs = pubDateRaw ? Date.parse(pubDateRaw) : Number.NaN;
    const tid = rawLink.match(/[?&]tid=([^&]+)/)?.[1];

    items.push({
      title,
      link,
      guid: tid ? `bing-${tid}` : link,
      pubDateMs: Number.isFinite(pubDateMs) ? pubDateMs : null,
      sourceName: decodeEntities(tagContent(body, "News:Source")).trim() || null,
      sourceUrl: null,
      descriptionHtml: tagContent(body, "description"),
      imageUrl: imageRaw ? normalizeBingImage(decodeEntities(imageRaw[1] ?? "")) : null,
    });
  }

  return items;
}
