import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { setSettingValue } from "@/server/repositories/settingsRepository";
import type { HealthResponse } from "@/types/earthquake";

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

describe("GET /api/health", () => {
  it("reporta base de datos operativa sin sincronizaciones", async () => {
    const response = await GET();
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.database).toBe("ok");
      expect(body.lastSyncAt).toBeNull();
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }
  });

  it("refleja la última sincronización registrada", async () => {
    setSettingValue("lastSyncAt", "2026-10-10T00:00:00.000Z");

    const response = await GET();
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    if (body.ok) {
      expect(body.lastSyncAt).toBe("2026-10-10T00:00:00.000Z");
    } else {
      expect.unreachable("la respuesta debía ser exitosa");
    }
  });

  it("responde 503 cuando la base de datos no responde", async () => {
    const globalForDb = globalThis as typeof globalThis & {
      __sismoPanamaDatabase?: unknown;
    };

    const brokenDb = {
      prepare() {
        throw new Error("boom");
      },
      exec() {
        throw new Error("boom");
      },
      pragma() {
        throw new Error("boom");
      },
      close() {},
    };

    const original = globalForDb.__sismoPanamaDatabase;
    globalForDb.__sismoPanamaDatabase = brokenDb;

    try {
      const response = await GET();
      const body = (await response.json()) as HealthResponse;

      expect(response.status).toBe(503);
      expect(body.ok).toBe(false);
      if (!body.ok) {
        expect(body.database).toBe("error");
        // Mensaje genérico, sin detalles internos.
        expect(body.message).not.toContain("boom");
      }
    } finally {
      globalForDb.__sismoPanamaDatabase = original;
    }
  });
});
