import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/settings/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import type { SettingsResponse, UserPreferences } from "@/types/earthquake";

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM app_settings").run();
});

describe("GET /api/settings", () => {
  it("devuelve las preferencias por defecto", async () => {
    const response = await GET();
    const body = (await response.json()) as SettingsResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.settings).toEqual({
        minMagnitude: 2.5,
        days: 7,
        orderBy: "time",
        notifyMinMagnitude: 4.5,
      });
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }
  });
});

describe("PUT /api/settings", () => {
  function putRequest(body: string): Request {
    return new Request("http://localhost:3000/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    });
  }

  it("guarda preferencias completas y las devuelve", async () => {
    const response = await PUT(
      putRequest(
        JSON.stringify({
          minMagnitude: 4,
          days: 14,
          orderBy: "magnitude",
          notifyMinMagnitude: 5.5,
        })
      )
    );
    const body = (await response.json()) as SettingsResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.settings).toEqual({
        minMagnitude: 4,
        days: 14,
        orderBy: "magnitude",
        notifyMinMagnitude: 5.5,
      } satisfies UserPreferences);
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }

    const after = (await (await GET()).json()) as SettingsResponse;
    if (after.ok) {
      expect(after.settings.orderBy).toBe("magnitude");
      expect(after.settings.days).toBe(14);
      expect(after.settings.notifyMinMagnitude).toBe(5.5);
    }
  });

  it("acepta actualizaciones parciales sobre las actuales", async () => {
    await PUT(putRequest(JSON.stringify({ minMagnitude: 5 })));

    const after = (await (await GET()).json()) as SettingsResponse;

    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.settings.minMagnitude).toBe(5);
      expect(after.settings.days).toBe(7);
      expect(after.settings.orderBy).toBe("time");
      expect(after.settings.notifyMinMagnitude).toBe(4.5);
    }
  });

  it("rechaza valores fuera de rango con 400", async () => {
    const response = await PUT(putRequest(JSON.stringify({ days: 99 })));
    const body = (await response.json()) as SettingsResponse;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.message).toMatch(/inválidas/i);
    }
  });

  it("rechaza umbrales de aviso fuera de rango con 400", async () => {
    const response = await PUT(
      putRequest(JSON.stringify({ notifyMinMagnitude: 99 }))
    );

    expect(response.status).toBe(400);
  });

  it("rechaza campos desconocidos con 400", async () => {
    const response = await PUT(
      putRequest(JSON.stringify({ telefono: "+5070000000" }))
    );

    expect(response.status).toBe(400);
  });

  it("rechaza cuerpos que no son JSON con 400", async () => {
    const response = await PUT(putRequest("no-json"));

    expect(response.status).toBe(400);
  });
});
