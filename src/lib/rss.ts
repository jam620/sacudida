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

/** Elimina etiquetas HTML y deja texto plano legible. */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
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
    });
  }

  return items;
}
