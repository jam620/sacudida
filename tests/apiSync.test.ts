import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/earthquakes/sync/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import { findEarthquakeById } from "@/server/repositories/earthquakeRepository";
import type { SyncResponse } from "@/types/earthquake";
import { jsonResponse, makeUsgsFeature, makeUsgsPayload } from "./fixtures/usgs";

const originalFetch = globalThis.fetch;

function postRequest(body?: string): Request {
  return new Request("http://localhost:3000/api/earthquakes/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ?? "",
  });
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM earthquakes").run();
  db.prepare("DELETE FROM app_settings").run();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("POST /api/earthquakes/sync", () => {
  it("sincroniza desde USGS y devuelve los contadores", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(makeUsgsPayload([makeUsgsFeature({ id: "sync-uno" })]))
    );

    const response = await POST(postRequest());
    const body = (await response.json()) as SyncResponse;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.inserted).toBe(1);
      expect(body.updated).toBe(0);
      expect(body.skipped).toBe(0);
    }
    expect(findEarthquakeById("sync-uno")).not.toBeNull();
  });

  it("acepta cuerpo con días y magnitud personalizados", async () => {
    let requestedUrl = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return jsonResponse(makeUsgsPayload([]));
    });

    const response = await POST(
      postRequest(JSON.stringify({ days: 14, minMagnitude: 4 }))
    );
    const body = (await response.json()) as SyncResponse;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(requestedUrl).toContain("minmagnitude=4");
  });

  it("responde 400 ante un cuerpo con días fuera de rango", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ days: 99 }))
    );
    const body = (await response.json()) as SyncResponse;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.message).toContain("days");
    }
  });

  it("responde 400 ante un cuerpo que no es JSON", async () => {
    const response = await POST(postRequest("esto-no-es-json"));

    expect(response.status).toBe(400);
  });

  it("responde 502 cuando USGS falla, sin stack traces", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, 503));

    const response = await POST(postRequest());
    const raw = await response.text();

    expect(response.status).toBe(502);
    expect(raw).toContain("USGS respondió con estado 503");
    expect(raw).not.toContain("at ");
    expect(raw).not.toContain("node_modules");
    expect(raw).not.toContain(".ts");
  });
});
