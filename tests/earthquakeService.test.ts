import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  getEarthquake,
  isHighImpact,
  isLocalPriority,
  isRelevant,
  parseFilters,
} from "@/server/services/earthquakeService";
import type { Earthquake } from "@/types/earthquake";

function makeEarthquake(overrides: Partial<Earthquake> = {}): Earthquake {
  return {
    id: "us7000abcd",
    magnitude: 4.5,
    place: "Panamá",
    longitude: -80.5,
    latitude: 8.5,
    depthKm: 10,
    time: 1_760_000_000_000,
    updated: 1_760_000_100_000,
    source: "us",
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
    tsunami: false,
    status: "reviewed",
    ...overrides,
  };
}

describe("parseFilters", () => {
  it("aplica valores por defecto", () => {
    expect(parseFilters({})).toEqual({
      minMagnitude: 2.5,
      days: 7,
      orderBy: "time",
    });
  });

  it("trata null y cadena vacía como ausentes (usa defectos)", () => {
    expect(
      parseFilters({ minMagnitude: null, days: "", orderBy: null })
    ).toEqual({ minMagnitude: 2.5, days: 7, orderBy: "time" });
  });

  it("convierte cadenas numéricas", () => {
    expect(
      parseFilters({ minMagnitude: "4.5", days: "14", orderBy: "magnitude" })
    ).toEqual({ minMagnitude: 4.5, days: 14, orderBy: "magnitude" });
  });

  it("acepta límites válidos", () => {
    expect(parseFilters({ minMagnitude: 0, days: 1, orderBy: "time" })).toEqual(
      { minMagnitude: 0, days: 1, orderBy: "time" }
    );
    expect(
      parseFilters({ minMagnitude: 10, days: 30, orderBy: "time" })
    ).toEqual({ minMagnitude: 10, days: 30, orderBy: "time" });
  });

  it("rechaza periodos mayores a 30 días", () => {
    expect(() => parseFilters({ days: 90 })).toThrow(ValidationError);
  });

  it("rechaza periodos menores a 1 día", () => {
    expect(() => parseFilters({ days: 0 })).toThrow(ValidationError);
  });

  it("rechaza magnitudes fuera de rango", () => {
    expect(() => parseFilters({ minMagnitude: -0.1 })).toThrow(ValidationError);
    expect(() => parseFilters({ minMagnitude: 10.1 })).toThrow(ValidationError);
  });

  it("rechaza órdenes desconocidos", () => {
    expect(() => parseFilters({ orderBy: "profundidad" })).toThrow(
      ValidationError
    );
  });

  it("incluye el campo problemático en el mensaje", () => {
    try {
      parseFilters({ days: 90 });
      expect.unreachable("debía lanzar ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain("days");
      expect((error as ValidationError).message).toMatch(/inválidos/i);
    }
  });
});

describe("getEarthquake (validación de ID)", () => {
  it("rechaza ID vacío o de solo espacios", () => {
    expect(() => getEarthquake("")).toThrow(ValidationError);
    expect(() => getEarthquake("   ")).toThrow(ValidationError);
  });
});

describe("reglas de relevancia", () => {
  it("considera relevante M >= 4.5", () => {
    expect(isRelevant(makeEarthquake({ magnitude: 4.5 }))).toBe(true);
    expect(isRelevant(makeEarthquake({ magnitude: 4.49 }))).toBe(false);
    expect(isRelevant(makeEarthquake({ magnitude: 7 }))).toBe(true);
  });

  it("considera alto impacto M >= 5.5", () => {
    expect(isHighImpact(makeEarthquake({ magnitude: 5.5 }))).toBe(true);
    expect(isHighImpact(makeEarthquake({ magnitude: 5.49 }))).toBe(false);
  });

  it("marca prioridad local a menos de 100 km del usuario", () => {
    const user = { latitude: 8.5, longitude: -80.5 };

    const near = makeEarthquake({ latitude: 8.55, longitude: -80.5 });
    const far = makeEarthquake({ latitude: 9.6, longitude: -80.5 });

    expect(isLocalPriority(near, user)).toBe(true);
    expect(isLocalPriority(far, user)).toBe(false);
  });
});
