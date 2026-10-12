import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/earthquakes/[id]/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { upsertEarthquakeRow } from "@/server/repositories/earthquakeRepository";
import type { EarthquakeDetailResponse } from "@/types/earthquake";

const EXISTING_ID = "us7000det";

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();

  upsertEarthquakeRow({
    id: EXISTING_ID,
    magnitude: 4.1,
    place: "Golfo de Chiriquí",
    longitude: -82.2,
    latitude: 8.1,
    depth_km: 15,
    occurred_at_utc: "2025-10-09T10:00:00.000Z",
    updated_at_utc: "2025-10-09T10:10:00.000Z",
    source: "us",
    external_url: `https://earthquake.usgs.gov/earthquakes/eventpage/${EXISTING_ID}`,
    tsunami_flag: 0,
    review_status: "reviewed",
    created_at: "2025-10-09T10:10:00.000Z",
    raw_json: "{}",
  });
});

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/earthquakes/[id]", () => {
  it("devuelve el detalle de un evento existente", async () => {
    const response = await GET(
      new Request(`http://localhost:3000/api/earthquakes/${EXISTING_ID}`),
      makeContext(EXISTING_ID)
    );
    const body = (await response.json()) as EarthquakeDetailResponse;

    expect(response.status).toBe(200);

    if (!body.ok) {
      expect.unreachable("la respuesta debía ser exitosa");
      return;
    }

    expect(body.earthquake.id).toBe(EXISTING_ID);
    expect(body.earthquake.magnitude).toBe(4.1);
    expect(body.earthquake.time).toBe(Date.parse("2025-10-09T10:00:00.000Z"));
    expect(body.earthquake.url).toContain(EXISTING_ID);
  });

  it("devuelve 404 para un evento inexistente", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes/us0000nope"),
      makeContext("us0000nope")
    );
    const body = (await response.json()) as EarthquakeDetailResponse;

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.message).toMatch(/no encontrado/i);
    }
  });

  it("devuelve 400 para un ID vacío o de solo espacios", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/earthquakes/%20%20"),
      makeContext("  ")
    );

    expect(response.status).toBe(400);
  });
});
