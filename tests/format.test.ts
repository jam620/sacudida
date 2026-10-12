import { describe, expect, it } from "vitest";
import {
  formatDepth,
  formatMagnitude,
  formatPanamaDateTime,
  formatPanamaDateTimeLong,
  formatRelativeTime,
  formatUtcDateTime,
  magnitudeLevel,
  magnitudeRadius,
  toIsoUtc,
} from "@/lib/format";

const EPOCH_2026_01_01 = Date.UTC(2026, 0, 1);

describe("toIsoUtc", () => {
  it("produce UTC ISO 8601 con sufijo Z", () => {
    expect(toIsoUtc(EPOCH_2026_01_01)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rechaza valores no finitos", () => {
    expect(() => toIsoUtc(Number.NaN)).toThrow(/inválida/i);
    expect(() => toIsoUtc(Number.POSITIVE_INFINITY)).toThrow(/inválida/i);
  });
});

describe("formatPanamaDateTime", () => {
  it("muestra la hora en America/Panama (UTC−5) en orden día/mes/año", () => {
    // 2026-01-01T00:00Z → 31 de diciembre de 2025, 7:00 p. m. en Panamá.
    const formatted = formatPanamaDateTime(EPOCH_2026_01_01);

    expect(formatted).toContain("31/12/2025");
    expect(formatted).toMatch(/7:00/);
    expect(formatted).toMatch(/p\.?\s?m\.?/i);
    // El orden día/mes/año no debe volver al formato norteamericano.
    expect(formatted).not.toContain("12/31/2025");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => formatPanamaDateTime(Number.NaN)).toThrow();
  });
});

describe("formatPanamaDateTimeLong", () => {
  it("expresa la fecha en palabras para lectores de voz", () => {
    // 2026-01-01T00:00Z → "31 de diciembre de 2025 a las 7:00 p. m."
    const spoken = formatPanamaDateTimeLong(EPOCH_2026_01_01);

    expect(spoken).toBe("31 de diciembre de 2025 a las 7:00 p. m.");
  });

  it("usa mediodía/medianoche correctamente", () => {
    // 17:00 UTC = 12:00 p. m. (mediodía) en Panamá.
    expect(formatPanamaDateTimeLong(Date.UTC(2026, 0, 1, 17))).toContain(
      "a las 12:00 p. m."
    );
    // 05:00 UTC = 12:00 a. m. (medianoche) en Panamá.
    expect(formatPanamaDateTimeLong(Date.UTC(2026, 0, 1, 5))).toContain(
      "a las 12:00 a. m."
    );
  });
});

describe("formatUtcDateTime", () => {
  it("muestra la referencia UTC legible", () => {
    expect(formatUtcDateTime(EPOCH_2026_01_01)).toContain("2026-01-01 00:00");
    expect(formatUtcDateTime(EPOCH_2026_01_01)).toContain("UTC");
  });
});

describe("formatDepth y formatMagnitude", () => {
  it("formatea profundidad y magnitud con un decimal", () => {
    expect(formatDepth(10.24)).toBe("10.2 km");
    expect(formatMagnitude(4.84)).toBe("4.8");
  });

  it("degrada sin lanzar errores ante valores no finitos", () => {
    expect(formatDepth(Number.NaN)).toBe("sin dato");
    expect(formatMagnitude(Number.NaN)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  it("expresa minutos y horas transcurridas", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);

    const fiveMinutesAgo = formatRelativeTime(now - 5 * 60_000, now);
    const twoHoursAgo = formatRelativeTime(now - 2 * 3_600_000, now);

    expect(fiveMinutesAgo).toMatch(/minuto|min/);
    expect(twoHoursAgo).toMatch(/hora/);
  });
});

describe("magnitudeLevel y magnitudeRadius", () => {
  it("clasifica los umbrales visuales M4/M5/M6", () => {
    expect(magnitudeLevel(3.9)).toBe("sky");
    expect(magnitudeLevel(4)).toBe("yellow");
    expect(magnitudeLevel(4.9)).toBe("yellow");
    expect(magnitudeLevel(5)).toBe("orange");
    expect(magnitudeLevel(5.9)).toBe("orange");
    expect(magnitudeLevel(6)).toBe("red");
    expect(magnitudeLevel(7.2)).toBe("red");
  });

  it("acota el radio del marcador entre 5 y 18 px", () => {
    expect(magnitudeRadius(0)).toBe(5);
    expect(magnitudeRadius(2.5)).toBeGreaterThan(4);
    expect(magnitudeRadius(9)).toBeLessThanOrEqual(18);
    expect(magnitudeRadius(Number.NaN)).toBe(5);
  });
});
