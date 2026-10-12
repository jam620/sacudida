/**
 * Utilidades de formato de presentación.
 *
 * Regla del contrato: la hora visible al usuario es America/Panama y el
 * almacenamiento es UTC ISO 8601. Estas funciones solo formatean; no
 * transforman datos almacenados.
 */

import { TIME_ZONE } from "./constants";

/** Epoch milisegundos → cadena UTC ISO 8601 (para almacenamiento/auditoría). */
export function toIsoUtc(epochMs: number): string {
  assertFiniteEpoch(epochMs, "epochMs");
  return new Date(epochMs).toISOString();
}

function assertFiniteEpoch(epochMs: number, label: string): void {
  if (!Number.isFinite(epochMs)) {
    throw new Error(`Fecha inválida: ${label} no es un número finito`);
  }
}

let panamaParts: Intl.DateTimeFormat | undefined;

function getPanamaPartsFormatter(): Intl.DateTimeFormat {
  panamaParts ??= new Intl.DateTimeFormat("es-PA", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return panamaParts;
}

/** Piezas sueltas en zona America/Panama (para reordenar/recomponer). */
function panamaPartsOf(epochMs: number): Map<string, string> {
  const parts = getPanamaPartsFormatter().formatToParts(new Date(epochMs));
  const map = new Map<string, string>();
  for (const part of parts) {
    if (part.type !== "literal") {
      map.set(part.type, part.value);
    }
  }
  return map;
}

/**
 * Fecha y hora visibles para el usuario, en zona America/Panama y orden
 * día/mes/año (formato local de Panamá; es-PA de Intl viene M/D/A).
 */
export function formatPanamaDateTime(epochMs: number): string {
  assertFiniteEpoch(epochMs, "epochMs");
  const p = panamaPartsOf(epochMs);
  return `${p.get("day")}/${p.get("month")}/${p.get("year")}, ${p.get("hour")}:${p.get("minute")} ${p.get("dayPeriod") ?? ""}`.trim();
}

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/**
 * Fecha y hora "hablada" para lectores de voz y accesibilidad:
 * "9 de octubre de 2026 a las 3:56 p. m." (zona America/Panama).
 * Evita el formato numérico, que el sintetizador puede leer mal.
 */
export function formatPanamaDateTimeLong(epochMs: number): string {
  assertFiniteEpoch(epochMs, "epochMs");
  const p = panamaPartsOf(epochMs);
  const monthIndex = Number(p.get("month")) - 1;
  const monthName = MESES_ES[monthIndex] ?? p.get("month") ?? "";
  const hour = Number(p.get("hour"));
  const spokenHour =
    hour === 0 || hour === 12 ? "12" : String(hour % 12).replace(/^0/, "");
  const period = (p.get("dayPeriod") ?? "").toLowerCase();
  return `${Number(p.get("day"))} de ${monthName} de ${p.get("year")} a las ${spokenHour}:${p.get("minute")} ${period}`.replace(/\s+/g, " ").trim();
}

/** Fecha y hora UTC legible, para mostrar como referencia secundaria. */
export function formatUtcDateTime(epochMs: number): string {
  assertFiniteEpoch(epochMs, "epochMs");
  // toISOString() siempre devuelve UTC con sufijo Z; se recorta a minuto.
  return `${new Date(epochMs).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Profundidad legible: "12.0 km". */
export function formatDepth(depthKm: number): string {
  return Number.isFinite(depthKm) ? `${depthKm.toFixed(1)} km` : "sin dato";
}

/** Magnitud legible con un decimal: "4.8". */
export function formatMagnitude(magnitude: number): string {
  return Number.isFinite(magnitude) ? magnitude.toFixed(1) : "—";
}

/** Tiempo relativo en español: "hace 5 minutos", "hace 2 horas". */
export function formatRelativeTime(
  epochMs: number,
  nowMs: number = Date.now()
): string {
  assertFiniteEpoch(epochMs, "epochMs");
  assertFiniteEpoch(nowMs, "nowMs");
  const diffSeconds = Math.round((epochMs - nowMs) / 1000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
  ];

  let value = diffSeconds;
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) {
      return formatter.format(Math.round(value), unit);
    }
    value /= size;
  }
  return formatter.format(Math.round(value), "month");
}

/** Nivel de color según magnitud (reglas visuales de docs/07). */
export type MagnitudeLevel = "sky" | "yellow" | "orange" | "red";

export function magnitudeLevel(magnitude: number): MagnitudeLevel {
  if (!Number.isFinite(magnitude)) return "sky";
  if (magnitude >= 6) return "red";
  if (magnitude >= 5) return "orange";
  if (magnitude >= 4) return "yellow";
  return "sky";
}

/** Clases Tailwind del badge de magnitud por nivel. */
export const MAGNITUDE_BADGE_CLASSES: Record<MagnitudeLevel, string> = {
  sky: "bg-sky-500/20 text-sky-300 ring-sky-500/60",
  yellow: "bg-yellow-500/20 text-yellow-300 ring-yellow-500/60",
  orange: "bg-orange-500/20 text-orange-300 ring-orange-500/60",
  red: "bg-red-500/20 text-red-300 ring-red-500/60",
};

/** Color hex del marcador del mapa por nivel (tema oscuro). */
export const MAGNITUDE_COLORS: Record<MagnitudeLevel, string> = {
  sky: "#38bdf8",
  yellow: "#facc15",
  orange: "#fb923c",
  red: "#ef4444",
};

/** Radio del marcador proporcional a la magnitud (mínimo 5, máximo 18 px). */
export function magnitudeRadius(magnitude: number): number {
  if (!Number.isFinite(magnitude)) return 5;
  return Math.min(18, Math.max(5, Math.round(4 + magnitude * 1.6)));
}
