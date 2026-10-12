/**
 * Tipos de la sección de noticias (agregadas vía RSS público de
 * Google Noticias con enlaces a los medios originales).
 */

export type NewsItem = {
  /** Identificador estable (guid del feed o hash del enlace). */
  id: string;
  title: string;
  /** URL de la noticia (enlace del medio original/redirección del feed). */
  url: string;
  /** Resumen breve, limpio de HTML. */
  summary: string;
  /** Imagen og:image del artículo; null si no se pudo conseguir. */
  imageUrl: string | null;
  /** Nombre del medio (p. ej., "TVN"). */
  source: string;
  /** Página del medio, si el feed la incluye. */
  sourceUrl: string | null;
  /** Publicación en epoch milisegundos (UTC); null si no viene. */
  publishedAt: number | null;
};

export type NewsResponse =
  | { ok: true; updatedAt: string; items: NewsItem[] }
  | { ok: false; message: string };
