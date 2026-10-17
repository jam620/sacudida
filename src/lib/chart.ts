/**
 * Geometría de la gráfica de réplicas: cada punto es un sismo, la altura
 * es la magnitud y la posición horizontal, las horas transcurridas desde
 * el sismo principal. Funciones puras para probarlas sin render.
 */

import type { Earthquake } from "@/types/earthquake";

/** Magnitud a partir de la cual el punto se dibuja grande. */
export const BIG_POINT_MAGNITUDE = 5;

const HOUR_MS = 3_600_000;
/** Tolerancia de reloj entre fuentes antes del sismo principal. */
const TOLERANCE_MS = 60_000;

export type AftershockPoint = {
  id: string;
  /** Horas (con fracción) desde el sismo principal; 0 para el principal. */
  hours: number;
  magnitude: number;
  isBig: boolean;
};

/**
 * Puntos de la secuencia: el sismo principal y todo lo ocurrido después.
 * Los eventos anteriores (ventana de días que aún los incluye) se omiten.
 */
export function buildAftershockPoints(
  earthquakes: Earthquake[],
  mainshockTimeMs: number
): AftershockPoint[] {
  const points: AftershockPoint[] = [];
  for (const earthquake of earthquakes) {
    const deltaMs = earthquake.time - mainshockTimeMs;
    if (deltaMs < -TOLERANCE_MS) {
      continue;
    }
    points.push({
      id: earthquake.id,
      hours: Math.max(0, deltaMs / HOUR_MS),
      magnitude: earthquake.magnitude,
      isBig: earthquake.magnitude >= BIG_POINT_MAGNITUDE,
    });
  }
  points.sort((a, b) => a.hours - b.hours);
  return points;
}

/**
 * Techo del eje X en horas legibles (mínimo 12 h): múltiplos de 6 h hasta
 * un día, de 12 h hasta dos, de 24 h hasta una semana y de 48 h después.
 */
export function hoursDomain(maxHours: number): number {
  if (!Number.isFinite(maxHours) || maxHours <= 0) {
    return 12;
  }
  const step =
    maxHours <= 24 ? 6 : maxHours <= 48 ? 12 : maxHours <= 168 ? 24 : 48;
  return Math.max(12, Math.ceil(maxHours / step) * step);
}

/** Marcas del eje X (incluye el 0), con paso tal que salgan 6 o menos. */
export function hourTicks(maxHours: number): number[] {
  const steps = [1, 2, 3, 6, 12, 24, 48, 96, 168];
  const step = steps.find((candidate) => maxHours / candidate <= 6) ?? 168;
  const ticks: number[] = [];
  for (let hour = 0; hour <= maxHours; hour += step) {
    ticks.push(hour);
  }
  return ticks;
}

/**
 * Rango del eje Y: enteros que envuelven a las magnitudes de la secuencia,
 * con un margen mínimo de un nivel arriba y abajo (recortado a 2–9).
 */
export function magnitudeDomain(points: AftershockPoint[]): {
  min: number;
  max: number;
} {
  if (points.length === 0) {
    return { min: 2, max: 6 };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    min = Math.min(min, point.magnitude);
    max = Math.max(max, point.magnitude);
  }
  return {
    min: Math.max(2, Math.floor(min) - 1),
    max: Math.min(9, Math.ceil(max) + 1),
  };
}

/** Radio del punto en la gráfica: grande para M 5 o más, pequeño el resto. */
export function pointRadius(isBig: boolean): number {
  return isBig ? 7 : 3.5;
}
