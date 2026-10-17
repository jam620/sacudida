import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as zonesGET, POST as zonesPOST } from "@/app/api/zones/route";
import { DELETE as zoneDELETE, PATCH as zonePATCH } from "@/app/api/zones/[id]/route";
import { ValidationError } from "@/lib/errors";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import {
  createWatchedZone,
  listWatchedZones,
} from "@/server/repositories/zonesRepository";
import {
  createZone,
  listZones,
  removeZone,
  updateZone,
} from "@/server/services/zonesService";

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM watched_zones").run();
});

afterEach(() => {
  // Estado limpio entre pruebas.
});

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("servicio de zonas", () => {
  it("crea, lista, actualiza (parcial) y elimina", () => {
    const zone = createZone({
      name: "Hogar",
      latitude: 8.5,
      longitude: -80.5,
      radiusKm: 50,
      minMagnitude: 4,
    });
    expect(zone.id).toBeGreaterThan(0);
    expect(zone.active).toBe(true);
    expect(listZones()).toHaveLength(1);

    const paused = updateZone(zone.id, { active: false, radiusKm: 100 });
    expect(paused?.active).toBe(false);
    expect(paused?.radiusKm).toBe(100);
    expect(paused?.name).toBe("Hogar");

    expect(removeZone(zone.id)).toBe(true);
    expect(removeZone(zone.id)).toBe(false);
    expect(listZones()).toHaveLength(0);
  });

  it("rechaza nombres vacíos y coordenadas fuera de rango", () => {
    expect(() =>
      createZone({ name: "  ", latitude: 8, longitude: -80, radiusKm: 50, minMagnitude: 4 })
    ).toThrow(ValidationError);
    expect(() =>
      createZone({ name: "X", latitude: 95, longitude: -80, radiusKm: 50, minMagnitude: 4 })
    ).toThrow(ValidationError);
    expect(() =>
      createZone({ name: "X", latitude: 8, longitude: -80, radiusKm: 5, minMagnitude: 4 })
    ).toThrow(ValidationError);
  });

  it("updateZone devuelve null para ids inexistentes", () => {
    expect(updateZone(9999, { active: false })).toBeNull();
  });
});

describe("API de zonas", () => {
  it("GET lista y POST crea (201)", async () => {
    const created = await zonesPOST(
      jsonRequest("POST", "http://localhost/api/zones", {
        name: "Trabajo",
        latitude: "8.98",
        longitude: "-79.52",
        radiusKm: 25,
        minMagnitude: 3.5,
      })
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { ok: boolean; zone: { id: number } };
    expect(body.ok).toBe(true);

    const listResponse = await zonesGET();
    const listBody = (await listResponse.json()) as {
      ok: boolean;
      zones: Array<{ name: string; latitude: number }>;
    };
    expect(listBody.zones).toHaveLength(1);
    // Coerción de strings a número (formularios HTML).
    expect(listBody.zones[0]?.latitude).toBeCloseTo(8.98, 5);
  });

  it("POST inválido responde 400", async () => {
    const response = await zonesPOST(
      jsonRequest("POST", "http://localhost/api/zones", { name: "" })
    );
    expect(response.status).toBe(400);
  });

  it("PATCH activa/pausa y DELETE elimina; 404 si no existe", async () => {
    const zone = createWatchedZone({
      name: "Casa",
      latitude: 7.4,
      longitude: -80.4,
      radiusKm: 50,
      minMagnitude: 4,
    });

    const missing = await zonePATCH(
      jsonRequest("PATCH", "http://localhost/api/zones/99999", { active: false }),
      { params: Promise.resolve({ id: "99999" }) }
    );
    expect(missing.status).toBe(404);

    const patched = await zonePATCH(
      jsonRequest("PATCH", `http://localhost/api/zones/${zone.id}`, { active: false }),
      { params: Promise.resolve({ id: String(zone.id) }) }
    );
    expect(patched.status).toBe(200);
    expect(listWatchedZones()[0]?.active).toBe(false);

    const deleted = await zoneDELETE(
      jsonRequest("DELETE", `http://localhost/api/zones/${zone.id}`),
      { params: Promise.resolve({ id: String(zone.id) }) }
    );
    expect(deleted.status).toBe(200);
    expect(listWatchedZones()).toHaveLength(0);
  });

  it("ids no numéricos responden 400", async () => {
    const response = await zoneDELETE(
      jsonRequest("DELETE", "http://localhost/api/zones/abc"),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(response.status).toBe(400);
  });
});
