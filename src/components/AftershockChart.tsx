"use client";

/**
 * Gráfica de la secuencia de réplicas: cada punto es un sismo (altura =
 * magnitud, posición horizontal = horas desde el sismo principal; los
 * puntos grandes son M 5 o más). Al pulsar un punto se selecciona el
 * sismo y el mapa vuela hasta él (FocusSelected). SVG propio, sin
 * dependencias de graficación.
 */

import {
  BIG_POINT_MAGNITUDE,
  buildAftershockPoints,
  hourTicks,
  hoursDomain,
  magnitudeDomain,
  pointRadius,
} from "@/lib/chart";
import {
  formatMagnitude,
  formatPanamaDateTime,
  magnitudeLevel,
  MAGNITUDE_COLORS,
} from "@/lib/format";
import type { Earthquake } from "@/types/earthquake";
import { useAftershockStats } from "@/hooks/useAftershockStats";

const WIDTH = 660;
const HEIGHT = 300;
const MARGIN = { top: 14, right: 14, bottom: 30, left: 40 };
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

type Props = {
  earthquakes: Earthquake[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function AftershockChart({
  earthquakes,
  selectedId,
  onSelect,
}: Props) {
  const { mainshock } = useAftershockStats();

  if (mainshock === null || earthquakes.length < 2) {
    return null;
  }

  const points = buildAftershockPoints(earthquakes, mainshock.time);
  // El principal puede estar fuera de la ventana de días que filtra la
  // lista; es la referencia de las 0 h, así que siempre se dibuja.
  if (!points.some((point) => point.id === mainshock.id)) {
    points.unshift({
      id: mainshock.id,
      hours: 0,
      magnitude: mainshock.magnitude,
      isBig: mainshock.magnitude >= BIG_POINT_MAGNITUDE,
    });
  }
  if (points.length < 2) {
    return null;
  }

  const maxHours = hoursDomain(points[points.length - 1]?.hours ?? 0);
  const { min: magMin, max: magMax } = magnitudeDomain(points);
  const ticks = hourTicks(maxHours);
  const byId = new Map(earthquakes.map((eq) => [eq.id, eq]));
  if (!byId.has(mainshock.id)) {
    byId.set(mainshock.id, mainshock);
  }

  const xOf = (hours: number): number =>
    MARGIN.left + (hours / maxHours) * INNER_WIDTH;
  const yOf = (magnitude: number): number =>
    MARGIN.top + INNER_HEIGHT - ((magnitude - magMin) / (magMax - magMin)) * INNER_HEIGHT;

  const magnitudeTicks: number[] = [];
  for (let level = magMin; level <= magMax; level += 1) {
    magnitudeTicks.push(level);
  }

  return (
    <section
      aria-labelledby="grafica-replicas-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
    >
      <h2
        id="grafica-replicas-titulo"
        className="text-base font-semibold text-slate-100"
      >
        Réplicas en el tiempo
      </h2>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Magnitud de cada sismo contra las horas desde el terremoto M ${formatMagnitude(mainshock.magnitude)} del ${formatPanamaDateTime(mainshock.time)}. Los puntos grandes son M ${BIG_POINT_MAGNITUDE} o más.`}
        className="mt-3 h-64 w-full sm:h-72"
      >
        {/* Rejilla horizontal: niveles de magnitud. */}
        {magnitudeTicks.map((level) => (
          <g key={`grid-${level}`}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yOf(level)}
              y2={yOf(level)}
              className="stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={yOf(level) + 4}
              textAnchor="end"
              className="fill-slate-400 text-[13px]"
            >
              M {level}
            </text>
          </g>
        ))}

        {/* Rejilla vertical: horas desde el sismo principal. */}
        {ticks.map((hour) => (
          <g key={`tick-${hour}`}>
            <line
              x1={xOf(hour)}
              x2={xOf(hour)}
              y1={MARGIN.top}
              y2={MARGIN.top + INNER_HEIGHT}
              className="stroke-slate-800/60"
              strokeWidth={1}
            />
            <text
              x={xOf(hour)}
              y={HEIGHT - 10}
              textAnchor="middle"
              className="fill-slate-400 text-[13px]"
            >
              {hour === 0 ? "0 h" : `${hour} h`}
            </text>
          </g>
        ))}

        {/* Puntos: un círculo por sismo de la secuencia. */}
        {points.map((point) => {
          const earthquake = byId.get(point.id);
          const isSelected = selectedId === point.id;
          const label =
            earthquake === undefined
              ? `M ${formatMagnitude(point.magnitude)} a ${point.hours.toFixed(0)} h`
              : `M ${formatMagnitude(point.magnitude)} · ${earthquake.place} · ${formatPanamaDateTime(earthquake.time)} hora de Panamá`;
          return (
            <circle
              key={point.id}
              cx={xOf(point.hours)}
              cy={yOf(point.magnitude)}
              r={pointRadius(point.isBig)}
              fill={MAGNITUDE_COLORS[magnitudeLevel(point.magnitude)]}
              stroke={isSelected ? "#f8fafc" : "#0f172a"}
              strokeWidth={isSelected ? 2 : 1}
              opacity={0.92}
              role="button"
              tabIndex={0}
              aria-label={`${label}. Pulsa para verlo en el mapa.`}
              className="cursor-pointer focus:outline-none focus-visible:stroke-white"
              onClick={() => onSelect(point.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(point.id);
                }
              }}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Cada punto es un sismo: la altura es la magnitud y la posición
        horizontal, las horas desde el sismo principal. Los puntos grandes
        son los de M {BIG_POINT_MAGNITUDE} o más. Pulsa uno para verlo en el
        mapa. Las réplicas suelen espaciarse con el paso de las horas.
      </p>
    </section>
  );
}
