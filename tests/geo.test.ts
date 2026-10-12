import { describe, expect, it } from "vitest";
import { distanceKm, isWithinRadius } from "@/lib/geo";
import { distanceKm as serviceDistanceKm } from "@/server/services/earthquakeService";

describe("distanceKm (haversine)", () => {
  it("devuelve 0 para el mismo punto", () => {
    const point = { latitude: 8.5, longitude: -80.5 };
    expect(distanceKm(point, point)).toBe(0);
  });

  it("es simétrica", () => {
    const a = { latitude: 8.5, longitude: -80.5 };
    const b = { latitude: 9.2, longitude: -79.8 };

    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });

  it("un grado de latitud mide aproximadamente 111.19 km", () => {
    const distance = distanceKm(
      { latitude: 8, longitude: -80 },
      { latitude: 9, longitude: -80 }
    );

    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112.5);
  });

  it("calcula la distancia del centro de Panamá a Ciudad de Panamá (~110 km)", () => {
    const distance = distanceKm(
      { latitude: 8.5, longitude: -80.5 },
      { latitude: 8.984, longitude: -79.519 }
    );

    expect(distance).toBeGreaterThan(95);
    expect(distance).toBeLessThan(125);
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(() =>
      distanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })
    ).toThrow(/inválidas/i);
    expect(() =>
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 181 })
    ).toThrow(/inválidas/i);
    expect(() =>
      distanceKm(
        { latitude: Number.NaN, longitude: 0 },
        { latitude: 0, longitude: 0 }
      )
    ).toThrow(/inválidas/i);
  });

  it("el servicio expone la misma fórmula", () => {
    const a = { latitude: 8.5, longitude: -80.5 };
    const b = { latitude: 9.2, longitude: -79.8 };

    expect(serviceDistanceKm(a, b)).toBeCloseTo(distanceKm(a, b), 6);
  });
});

describe("isWithinRadius", () => {
  it("clasifica correctamente dentro y fuera del radio", () => {
    const center = { latitude: 8.5, longitude: -80.5 };
    const near = { latitude: 8.51, longitude: -80.49 };
    const far = { latitude: 12, longitude: -75 };

    expect(isWithinRadius(center, near, 100)).toBe(true);
    expect(isWithinRadius(center, far, 100)).toBe(false);
  });

  it("rechaza radios inválidos", () => {
    const point = { latitude: 8.5, longitude: -80.5 };
    expect(() => isWithinRadius(point, point, -1)).toThrow();
    expect(() => isWithinRadius(point, point, Number.NaN)).toThrow();
  });
});
