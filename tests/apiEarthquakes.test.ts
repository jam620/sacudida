import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/earthquakes/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { upsertEarthquakeRow } from "@/server/repositories/earthquakeRepository";
import type { EarthquakesResponse } from "@/types/earthquake";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function seed(): void {
  upsertEarthquakeRow({
    id: "api-1",
    magnitude: 3.2,
    place: "Border de Costa Rica y Panamá",
    longitude: -82.9,
    latitude: 9.1,
    depth_km: 20,
    occurred_at_utc: hoursAgo(2),
    updated_at_utc: hoursAgo(2),
    source: "us",
    external_url: "https://earthquake.usgs.gov/earthquakes/eventpage/api-1",
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: hoursAgo(2),
    raw_json: "{}",
  });

  upsertEarthquakeRow({
    id: "api-2",
    magnitude: 5.4,
    place: "Mar Caribe frente a Colón",
    longitude: -79.5,
    latitude: 9.6,
    depth_km: 35,
    occurred_at_utc: hoursAgo(5),
    updated_at_utc: hoursAgo(5),
    source: "us",
    external_url: "https://earthquake.usgs.gov/earthquakes/eventpage/api-2",
    tsunami_flag: 1,
    review_status: "automatic",
    created_at: hoursAgo(5),
    raw_json: "{}",
  });
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

describe("GET /api/earthquakes", () => {
  it("devuelve la lista con el envelope documentado", async () => {
    seed();

    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes")
    );
    const body = (await response.json()) as EarthquakesResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    if (!body.ok) {
      expect.unreachable("la respuesta debía ser exitosa");
      return;
    }

    expect(body.source).toBe("sqlite");
    expect(body.count).toBe(2);
    expect(body.filters).toEqual({
      minMagnitude: 2.5,
      days: 7,
      orderBy: "time",
    });

    // Orden por tiempo: el más reciente primero.
    expect(body.earthquakes[0]?.id).toBe("api-1");
    expect(body.earthquakes[1]?.id).toBe("api-2");

    const second = body.earthquakes[1];
    expect(second?.tsunami).toBe(true);
    expect(second?.url).toContain("earthquake.usgs.gov");
  });

  it("aplica los filtros de magnitud y orden", async () => {
    seed();

    const response = await GET(
      new Request(
        "http://localhost:3000/api/earthquakes?minMagnitude=5&orderBy=magnitude"
      )
    );
    const body = (await response.json()) as EarthquakesResponse;

    expect(response.status).toBe(200);
    if (!body.ok) {
      expect.unreachable("la respuesta debía ser exitosa");
      return;
    }

    expect(body.filters.minMagnitude).toBe(5);
    expect(body.filters.orderBy).toBe("magnitude");
    expect(body.earthquakes.map((e) => e.id)).toEqual(["api-2"]);
  });

  it("responde 200 con lista vacía cuando la base está vacía", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes")
    );
    const body = (await response.json()) as EarthquakesResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.count).toBe(0);
      expect(body.earthquakes).toEqual([]);
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }
  });

  it("responde 400 controlado ante filtros inválidos", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes?days=999")
    );
    const body = (await response.json()) as EarthquakesResponse;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.message).toMatch(/inválidos/i);
      expect(body.message).toContain("days");
    }
  });

  it("no expone stack traces, rutas locales ni variables de entorno", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes?orderBy=hack")
    );

    const raw = await response.text();

    expect(response.status).toBe(400);
    expect(raw).not.toContain("at ");
    expect(raw).not.toContain("node_modules");
    expect(raw).not.toContain(".ts");
    expect(raw).not.toContain("process.env");
    expect(raw).not.toContain("stack");
  });
});
