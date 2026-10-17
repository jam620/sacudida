import { describe, expect, it } from "vitest";
import {
  BIG_POINT_MAGNITUDE,
  buildAftershockPoints,
  hourTicks,
  hoursDomain,
  magnitudeDomain,
  pointRadius,
} from "@/lib/chart";
import type { Earthquake } from "@/types/earthquake";

const HOUR = 3_600_000;

function quake(
  id: string,
  magnitude: number,
  deltaHours: number,
  mainshockTime: number
): Earthquake {
  return {
    id,
    magnitude,
    place: "50 km de Tonosí, Panama",
    longitude: -80.4,
    latitude: 7.4,
    depthKm: 10,
    time: mainshockTime + deltaHours * HOUR,
    updated: mainshockTime + deltaHours * HOUR,
    source: "usgs",
    url: "https://earthquake.usgs.gov/",
    tsunami: false,
    status: "reviewed",
  };
}

describe("buildAftershockPoints", () => {
  const mainshockTime = Date.UTC(2026, 9, 9, 17, 56, 0);

  it("incluye al principal y a las réplicas con sus horas", () => {
    const earthquakes = [
      quake("main", 7.7, 0, mainshockTime),
      quake("a1", 4.2, 1.5, mainshockTime),
      quake("a2", 5.1, 20, mainshockTime),
    ];
    const points = buildAftershockPoints(earthquakes, mainshockTime);

    expect(points).toHaveLength(3);
    expect(points[0]?.id).toBe("main");
    expect(points[0]?.hours).toBe(0);
    expect(points[1]?.hours).toBeCloseTo(1.5, 6);
    // Orden temporal ascendente.
    expect(points[2]?.id).toBe("a2");
  });

  it("marca como grandes solo los de M 5 o más", () => {
    const earthquakes = [
      quake("small", 4.9, 2, mainshockTime),
      quake("big", BIG_POINT_MAGNITUDE, 3, mainshockTime),
    ];
    const points = buildAftershockPoints(earthquakes, mainshockTime);

    expect(points[0]?.isBig).toBe(false);
    expect(points[1]?.isBig).toBe(true);
  });

  it("descarta eventos anteriores al principal (más una tolerancia de 1 min)", () => {
    const earthquakes = [
      quake("old", 3.1, -48, mainshockTime),
      quake("edge", 3.2, -30 / 3_600_000, mainshockTime),
      quake("new", 3.3, 1, mainshockTime),
    ];
    const points = buildAftershockPoints(earthquakes, mainshockTime);

    expect(points.map((point) => point.id)).toEqual(["edge", "new"]);
    // El evento dentro de la tolerancia se recorta a 0 h, nunca negativo.
    expect(points[0]?.hours).toBe(0);
  });
});

describe("hoursDomain", () => {
  it("devuelve mínimo 12 h y redondea hacia arriba en pasos legibles", () => {
    expect(hoursDomain(0)).toBe(12);
    expect(hoursDomain(3)).toBe(12);
    expect(hoursDomain(7)).toBe(12);
    expect(hoursDomain(13)).toBe(18);
    expect(hoursDomain(30)).toBe(36);
    expect(hoursDomain(100)).toBe(120);
    expect(hoursDomain(200)).toBe(240);
  });
});

describe("hourTicks", () => {
  it("genera marcas con paso creciente y sin pasarse de 6", () => {
    expect(hourTicks(12)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(hourTicks(36)).toEqual([0, 6, 12, 18, 24, 30, 36]);
    expect(hourTicks(120)).toEqual([0, 24, 48, 72, 96, 120]);
    for (const max of [12, 24, 48, 120, 240]) {
      expect(hourTicks(max).length).toBeLessThanOrEqual(7);
      expect(hourTicks(max)[0]).toBe(0);
    }
  });
});

describe("magnitudeDomain", () => {
  it("envuelve las magnitudes con margen de un nivel", () => {
    const points = [
      { id: "a", hours: 0, magnitude: 7.7, isBig: true },
      { id: "b", hours: 2, magnitude: 2.6, isBig: false },
    ];
    expect(magnitudeDomain(points)).toEqual({ min: 2, max: 9 });
  });

  it("usa un rango razonable sin datos", () => {
    expect(magnitudeDomain([])).toEqual({ min: 2, max: 6 });
  });
});

describe("pointRadius", () => {
  it("los grandes son el doble de los pequeños", () => {
    expect(pointRadius(true)).toBe(7);
    expect(pointRadius(false)).toBe(3.5);
  });
});
