import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { apiFetcher } from "@/lib/api";
import { ValidationError, errorMessage } from "@/lib/errors";
import {
  buildNotificationBody,
  notificationsSupported,
} from "@/lib/notifications";
import { playAlertSound, unlockAudio } from "@/lib/sound";
import { loadEnvLocal } from "@/server/env";
import type { Earthquake } from "@/types/earthquake";

describe("apiFetcher", () => {
  it("devuelve el payload cuando ok es true", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, value: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    try {
      const data = await apiFetcher<{ ok: true; value: number }>("/x");
      expect(data.value).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("lanza el mensaje del servidor cuando ok es false", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, message: "Filtros inválidos" }), {
        status: 400,
      })) as unknown as typeof fetch;

    try {
      await expect(apiFetcher("/x")).rejects.toThrow("Filtros inválidos");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("traduce fallos de red y JSON inválido a mensajes claros", async () => {
    const original = globalThis.fetch;

    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(apiFetcher("/x")).rejects.toThrow(/No fue posible conectar/);

    globalThis.fetch = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(apiFetcher("/x")).rejects.toThrow(/no válida/);

    globalThis.fetch = original;
  });
});

describe("errorMessage", () => {
  it("usa el mensaje del error y cae al fallback cuando no hay", () => {
    expect(errorMessage(new ValidationError("x"), "fallback")).toBe("x");
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage("una cadena", "fallback")).toBe("fallback");
    expect(errorMessage({}, "fallback")).toBe("fallback");
  });
});

describe("notifications (entorno sin navegador)", () => {
  it("degrada sin window y el cuerpo del aviso se puede construir", () => {
    expect(notificationsSupported()).toBe(false);

    const earthquake: Earthquake = {
      id: "us7000x",
      magnitude: 5.2,
      place: "Cerca de Tonosí",
      longitude: -80.4,
      latitude: 7.7,
      depthKm: 10,
      time: Date.UTC(2026, 9, 10, 12, 0, 0),
      updated: Date.UTC(2026, 9, 10, 12, 5, 0),
      source: "us",
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000x",
      tsunami: false,
      status: "reviewed",
    };

    const body = buildNotificationBody(earthquake);
    expect(body).toContain("M 5.2");
    expect(body).toContain("Cerca de Tonosí");
    expect(body).toContain("hora de Panamá");
  });
});

describe("sound (entorno sin navegador)", () => {
  it("degrada sin AudioContext y nunca lanza excepciones", () => {
    expect(playAlertSound()).toBe(false);
    expect(playAlertSound({ urgent: true })).toBe(false);
    expect(() => unlockAudio()).not.toThrow();
  });
});

describe("loadEnvLocal", () => {
  const envPath = path.join(process.cwd(), ".env.local");

  function withEnvFile(content: string | null, run: () => void): void {
    const backup = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf8")
      : null;

    try {
      if (content === null) {
        if (backup !== null) fs.rmSync(envPath);
      } else {
        fs.writeFileSync(envPath, content, "utf8");
      }
      run();
    } finally {
      if (backup !== null) {
        fs.writeFileSync(envPath, backup, "utf8");
      } else if (fs.existsSync(envPath)) {
        fs.rmSync(envPath);
      }
    }
  }

  it("carga pares clave=valor sin sobrescribir el entorno actual", () => {
    withEnvFile(
      "# comentario\nSACUDIDA_TEST_NUEVO=42\nSACUDIDA_TEST_COMILLAS=\"hola\"\n=invalido\n",
      () => {
        process.env.SACUDIDA_TEST_EXISTENTE = "original";
        loadEnvLocal();

        expect(process.env.SACUDIDA_TEST_NUEVO).toBe("42");
        expect(process.env.SACUDIDA_TEST_COMILLAS).toBe("hola");
        // Las variables ya presentes no se pisan.
        expect(process.env.SACUDIDA_TEST_EXISTENTE).toBe("original");

        delete process.env.SACUDIDA_TEST_NUEVO;
        delete process.env.SACUDIDA_TEST_COMILLAS;
        delete process.env.SACUDIDA_TEST_EXISTENTE;
      }
    );
  });

  it("no falla si .env.local no existe", () => {
    withEnvFile(null, () => {
      expect(() => loadEnvLocal()).not.toThrow();
    });
  });
});
