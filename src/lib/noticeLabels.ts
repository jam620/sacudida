/**
 * Etiquetado honesto de los avisos de Sacudida.
 *
 * Regla crítica del producto: NUNCA se llama "alerta temprana" a un aviso
 * generado después de que la fuente publica el evento. Los sismólogos
 * pueden emitir alerta temprana entre la detección y la llegada de las
 * ondas; Sacudida solo informa lo ya publicado.
 */

export type NoticeKind = "info" | "post-event" | "eew-confirmed";

export const NOTICE_LABELS: Record<NoticeKind, string> = {
  /** Datos del catálogo, sin carácter de urgencia. */
  info: "Información sísmica",
  /** Aviso push/navegador generado tras la publicación de la fuente. */
  "post-event": "Aviso posterior a la publicación del sismo",
  /** Reservado: solo si una autoridad con EEW real se integra. */
  "eew-confirmed": "Alerta temprana confirmada por fuente autorizada",
};

export const NOTICE_DISCLAIMER =
  "Sacudida no predice sismos. No es una alerta oficial.";

/** Etiqueta corta para títulos de notificación (limitados en caracteres). */
export const NOTICE_SHORT_LABELS: Record<NoticeKind, string> = {
  info: "Información sísmica",
  "post-event": "Aviso post-sismo",
  "eew-confirmed": "Alerta temprana oficial",
};
