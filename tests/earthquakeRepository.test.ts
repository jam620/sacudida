import { beforeEach, describe, expect, it } from "vitest";
import type { EarthquakeRow } from "@/types/earthquake";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import {
  countAftershocksSince,
  countEarthquakes,
  deleteOldEarthquakes,
  findEarthquakeById,
  findEarthquakes,
  findRelevantEarthquakes,
  findStrongestEarthquake,
  findUpdatedAtUtcById,
  upsertEarthquakeRow,
} from "@/server/repositories/earthquakeRepository";

let rowCounter = 0;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function makeRow(overrides: Partial<EarthquakeRow> = {}): EarthquakeRow {
  rowCounter += 1;
  return {
    id: `eq-test-${rowCounter}`,
    magnitude: 3,
    place: "Cerca de Panamá",
    longitude: -80.5,
    latitude: 8.5,
    depth_km: 25,
    occurred_at_utc: hoursAgo(1),
    updated_at_utc: hoursAgo(1),
    source: "us",
    external_url: "https://earthquake.usgs.gov/earthquakes/eventpage/test",
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: hoursAgo(1),
    raw_json: "{}",
    ...overrides,
  };
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

describe("upsertEarthquakeRow", () => {
  it("inserta un evento nuevo y lo devuelve como dominio", () => {
    upsertEarthquakeRow(
      makeRow({
        id: "us1",
        tsunami_flag: 1,
        occurred_at_utc: "2025-10-01T12:00:00.000Z",
        updated_at_utc: "2025-10-01T12:05:00.000Z",
      })
    );

    const found = findEarthquakeById("us1");

    expect(found).not.toBeNull();
    expect(found?.magnitude).toBe(3);
    expect(found?.tsunami).toBe(true);
    expect(found?.time).toBe(Date.parse("2025-10-01T12:00:00.000Z"));
    expect(found?.updated).toBe(Date.parse("2025-10-01T12:05:00.000Z"));
    expect(found?.place).toBe("Cerca de Panamá");
  });

  it("es idempotente: sin cambio de updated_at_utc no sobrescribe", () => {
    const original = makeRow({ id: "us3", magnitude: 5, updated_at_utc: hoursAgo(3) });
    upsertEarthquakeRow(original);

    const sinCambios = { ...original, magnitude: 9.9 };
    upsertEarthquakeRow(sinCambios);

    expect(findEarthquakeById("us3")?.magnitude).toBe(5);
  });

  it("actualiza cuando updated_at_utc cambia", () => {
    const fechaOriginal = hoursAgo(3);
    const fechaNueva = hoursAgo(1);

    upsertEarthquakeRow(
      makeRow({ id: "us4", magnitude: 5, updated_at_utc: fechaOriginal })
    );

    upsertEarthquakeRow({
      ...makeRow({ id: "us4" }),
      magnitude: 6.1,
      updated_at_utc: fechaNueva,
    });

    const updated = findEarthquakeById("us4");
    expect(updated?.magnitude).toBe(6.1);
    expect(updated?.updated).toBe(Date.parse(fechaNueva));
  });
});

describe("findEarthquakes", () => {
  it("filtra por magnitud mínima y periodo, y ordena por tiempo", () => {
    upsertEarthquakeRow(makeRow({ id: "a", magnitude: 2.6, occurred_at_utc: hoursAgo(2) }));
    upsertEarthquakeRow(makeRow({ id: "b", magnitude: 4.8, occurred_at_utc: hoursAgo(4) }));
    upsertEarthquakeRow(makeRow({ id: "c", magnitude: 5.2, occurred_at_utc: hoursAgo(1) }));
    upsertEarthquakeRow(makeRow({ id: "viejo", magnitude: 6, occurred_at_utc: hoursAgo(24 * 8) }));

    const result = findEarthquakes({ minMagnitude: 2.5, days: 7, orderBy: "time" });

    expect(result.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("ordena por magnitud cuando se solicita", () => {
    upsertEarthquakeRow(makeRow({ id: "a", magnitude: 2.6, occurred_at_utc: hoursAgo(1) }));
    upsertEarthquakeRow(makeRow({ id: "b", magnitude: 4.8, occurred_at_utc: hoursAgo(2) }));
    upsertEarthquakeRow(makeRow({ id: "c", magnitude: 5.2, occurred_at_utc: hoursAgo(3) }));

    const result = findEarthquakes({ minMagnitude: 2.5, days: 7, orderBy: "magnitude" });

    expect(result.map((e) => e.magnitude)).toEqual([5.2, 4.8, 2.6]);
  });

  it("respeta la magnitud mínima solicitada", () => {
    upsertEarthquakeRow(makeRow({ id: "a", magnitude: 3.0 }));
    upsertEarthquakeRow(makeRow({ id: "b", magnitude: 5.5 }));

    const result = findEarthquakes({ minMagnitude: 5, days: 7, orderBy: "time" });

    expect(result.map((e) => e.id)).toEqual(["b"]);
  });
});

describe("findRelevantEarthquakes", () => {
  it("devuelve solo eventos con M >= 4.5", () => {
    upsertEarthquakeRow(makeRow({ id: "bajo", magnitude: 3.1 }));
    upsertEarthquakeRow(makeRow({ id: "medio", magnitude: 4.5 }));
    upsertEarthquakeRow(makeRow({ id: "alto", magnitude: 6.7 }));

    const result = findRelevantEarthquakes({ days: 7 });

    expect(result.map((e) => e.id).sort()).toEqual(["alto", "medio"]);
  });
});

describe("countEarthquakes", () => {
  it("cuenta solo los eventos dentro del periodo", () => {
    upsertEarthquakeRow(makeRow({ id: "nuevo", occurred_at_utc: hoursAgo(1) }));
    upsertEarthquakeRow(makeRow({ id: "antiguo", occurred_at_utc: hoursAgo(24 * 40) }));

    expect(countEarthquakes(7)).toBe(1);
    expect(countEarthquakes(60)).toBe(2);
  });
});

describe("deleteOldEarthquakes", () => {
  it("elimina eventos anteriores al periodo y devuelve el total", () => {
    upsertEarthquakeRow(makeRow({ id: "nuevo", occurred_at_utc: hoursAgo(1) }));
    upsertEarthquakeRow(makeRow({ id: "viejo1", occurred_at_utc: hoursAgo(24 * 40) }));
    upsertEarthquakeRow(makeRow({ id: "viejo2", occurred_at_utc: hoursAgo(24 * 50) }));

    const deleted = deleteOldEarthquakes(30);

    expect(deleted).toBe(2);
    expect(findEarthquakeById("nuevo")).not.toBeNull();
    expect(findEarthquakeById("viejo1")).toBeNull();
    expect(findEarthquakeById("viejo2")).toBeNull();
  });
});

describe("findStrongestEarthquake / countAftershocksSince", () => {
  it("encuentra el principal y cuenta las réplicas posteriores", () => {
    const mainshockAt = hoursAgo(26);
    upsertEarthquakeRow(makeRow({ id: "principal", magnitude: 7.7, occurred_at_utc: mainshockAt }));
    upsertEarthquakeRow(makeRow({ id: "rep-old", magnitude: 3.0, occurred_at_utc: hoursAgo(25) }));
    upsertEarthquakeRow(makeRow({ id: "rep-24h", magnitude: 3.2, occurred_at_utc: hoursAgo(20) }));
    upsertEarthquakeRow(makeRow({ id: "rep-1h", magnitude: 3.5, occurred_at_utc: hoursAgo(0.5) }));
    upsertEarthquakeRow(makeRow({ id: "pre-sismo", magnitude: 4.2, occurred_at_utc: hoursAgo(30) }));

    const strongest = findStrongestEarthquake({ days: 30, minMagnitude: 6.5 });
    expect(strongest?.id).toBe("principal");

    const counts = countAftershocksSince(mainshockAt, { minMagnitude: 2.5 });
    expect(counts.total).toBe(3);
    expect(counts.last24h).toBe(2);
    expect(counts.lastHour).toBe(1);
  });

  it("respeta la magnitud mínima del umbral de principal", () => {
    upsertEarthquakeRow(makeRow({ id: "moderado", magnitude: 5.9, occurred_at_utc: hoursAgo(3) }));
    expect(
      findStrongestEarthquake({ days: 30, minMagnitude: 6.5 })
    ).toBeNull();
  });
});
