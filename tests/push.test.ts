import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as subscribeRoute } from "@/app/api/push/subscribe/route";
import { POST as unsubscribeRoute } from "@/app/api/push/unsubscribe/route";
import { PUT as preferencesRoute } from "@/app/api/push/preferences/route";
import { getDatabase } from "@/server/database/client";
import { initializeDatabase } from "@/server/database/migrations";
import {
  countPushSubscriptions,
  listPushSubscriptions,
  upsertPushSubscription,
} from "@/server/repositories/pushRepository";
import { lastPushStatus } from "@/server/repositories/observabilityRepository";
import { createWatchedZone } from "@/server/repositories/zonesRepository";
import {
  buildEarthquakePushPayload,
  decidePushRecipients,
  dispatchPushForEarthquakes,
} from "@/server/services/pushService";
import { NOTICE_DISCLAIMER, NOTICE_SHORT_LABELS } from "@/lib/noticeLabels";
import type { Earthquake } from "@/types/earthquake";

vi.mock("web-push", () => ({
  default: {
    sendNotification: vi.fn(),
    generateVAPIDKeys: vi.fn(() => ({
      publicKey: "pub-test",
      privateKey: "priv-test",
    })),
  },
}));

const webpush = (await import("web-push")).default as unknown as {
  sendNotification: ReturnType<typeof vi.fn>;
};

function quake(overrides: Partial<Earthquake> = {}): Earthquake {
  return {
    id: "us7000push",
    magnitude: 5.2,
    place: "30 km de Tonosí, Panama",
    longitude: -80.4,
    latitude: 7.4,
    depthKm: 10,
    time: Date.now() - 60_000,
    updated: Date.now() - 30_000,
    source: "usgs",
    url: "https://earthquake.usgs.gov/eventpage/us7000push",
    tsunami: false,
    status: "reviewed",
    ...overrides,
  };
}

function subscription(endpoint: string, notifyMinMagnitude = 4.5) {
  return {
    endpoint,
    p256dh: `key-${endpoint}`,
    auth: `auth-${endpoint}`,
    notifyMinMagnitude,
    createdAt: "2026-10-16T00:00:00.000Z",
    lastSeenAt: "2026-10-16T00:00:00.000Z",
  };
}

beforeEach(() => {
  const db = getDatabase();
  initializeDatabase(db);
  db.prepare("DELETE FROM push_subscriptions").run();
  db.prepare("DELETE FROM push_log").run();
  db.prepare("DELETE FROM watched_zones").run();
  db.prepare("DELETE FROM sync_log").run();
  process.env.VAPID_PRIVATE_KEY = "clave-privada-test";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "clave-publica-test";
  process.env.VAPID_SUBJECT = "mailto:test@example.org";
  webpush.sendNotification.mockReset();
});

afterEach(() => {
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_SUBJECT;
  vi.restoreAllMocks();
});

describe("decidePushRecipients", () => {
  it("con zonas activas: solo quien está dentro del radio y la magnitud", () => {
    const sub = subscription("https://push.example/a");
    const far = subscription("https://push.example/b");
    createWatchedZone({
      name: "Casa",
      latitude: 7.4,
      longitude: -80.4,
      radiusKm: 50,
      minMagnitude: 4.5,
    });

    const decisions = decidePushRecipients(
      quake({ latitude: 7.5, longitude: -80.45, magnitude: 5.0 }),
      [sub, far].map((entry) =>
        upsertPushSubscription({ ...entry, notifyMinMagnitude: entry.notifyMinMagnitude })
      ),
      [
        {
          id: 1,
          name: "Casa",
          latitude: 7.4,
          longitude: -80.4,
          radiusKm: 50,
          minMagnitude: 4.5,
          active: true,
        },
      ]
    );

    // Ambas suscripciones comparten las mismas zonas (globales): ambas
    // reciben; la cercana con etiqueta de distancia.
    expect(decisions).toHaveLength(2);
    expect(decisions[0]?.distanceLabel).toMatch(/a \d+ km de Casa/);
  });

  it("zona activa con magnitud insuficiente: no se envía", () => {
    const decisions = decidePushRecipients(
      quake({ magnitude: 3.9 }),
      [subscription("https://push.example/a")].map((entry) =>
        upsertPushSubscription({ ...entry })
      ),
      [
        {
          id: 1,
          name: "Trabajo",
          latitude: 7.4,
          longitude: -80.4,
          radiusKm: 100,
          minMagnitude: 4.5,
          active: true,
        },
      ]
    );
    expect(decisions).toHaveLength(0);
  });

  it("zona pausada no filtra; sin zonas aplica el umbral de la suscripción", () => {
    const low = subscription("https://push.example/low", 5.5);
    const high = subscription("https://push.example/high", 4.0);

    const decisions = decidePushRecipients(
      quake({ magnitude: 4.4 }),
      [low, high].map((entry) => upsertPushSubscription({ ...entry })),
      [
        {
          id: 1,
          name: "Pausada",
          latitude: 0,
          longitude: 0,
          radiusKm: 100,
          minMagnitude: 2,
          active: false,
        },
      ]
    );

    expect(decisions.map((decision) => decision.subscription.endpoint)).toEqual([
      "https://push.example/high",
    ]);
    expect(decisions[0]?.distanceLabel).toBeNull();
  });
});

describe("buildEarthquakePushPayload", () => {
  it("incluye magnitud, lugar, hora, distancia y etiquetado honesto", () => {
    const payload = buildEarthquakePushPayload(quake(), "a 22 km de Casa");
    expect(payload.magnitude).toBe(5.2);
    expect(payload.place).toContain("Tonosí");
    expect(payload.timeLabel).toMatch(/de octubre de 2026|de octubre/);
    expect(payload.distanceLabel).toBe("a 22 km de Casa");
    expect(payload.appUrl).toBe("/?sismo=us7000push");
    expect(payload.label).toBe(NOTICE_SHORT_LABELS["post-event"]);
    expect(payload.disclaimer).toBe(NOTICE_DISCLAIMER);
  });
});

describe("dispatchPushForEarthquakes", () => {
  it("envía solo a quien corresponde y registra la latencia", async () => {
    upsertPushSubscription({ ...subscription("https://push.example/a", 4.5) });
    upsertPushSubscription({ ...subscription("https://push.example/b", 6.5) });
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

    const event = quake({ magnitude: 5.0 });
    const result = await dispatchPushForEarthquakes([event], {
      receivedAtIso: "2026-10-16T12:00:00.000Z",
    });

    expect(result.sent).toBe(1);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);

    const log = lastPushStatus();
    expect(log?.status).toBe("sent");
    expect(log?.earthquakeId).toBe(event.id);
    expect(log?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(log?.sourcePublishedAt).toBe(new Date(event.updated).toISOString());
  });

  it("suscripción expirada (410): se elimina y se registra", async () => {
    upsertPushSubscription({ ...subscription("https://push.example/dead", 4.5) });
    const gone = Object.assign(new Error("gone"), { statusCode: 410 });
    webpush.sendNotification.mockRejectedValue(gone);

    const result = await dispatchPushForEarthquakes([quake({ magnitude: 5 })]);

    expect(result.expired).toBe(1);
    expect(countPushSubscriptions()).toBe(0);
    expect(lastPushStatus()?.status).toBe("expired");
  });

  it("idempotente: no reenvía un evento ya notificado", async () => {
    upsertPushSubscription({ ...subscription("https://push.example/a", 4.5) });
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

    await dispatchPushForEarthquakes([quake({ magnitude: 5 })]);
    const second = await dispatchPushForEarthquakes([quake({ magnitude: 5 })]);

    expect(second.sent).toBe(0);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("sin claves VAPID: se omite sin error", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const result = await dispatchPushForEarthquakes([quake()]);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("vapid-no-configurado");
  });
});

describe("API de push", () => {
  function jsonRequest(method: string, url: string, body: unknown): Request {
    return new Request(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("subscribe registra y unsubscribe elimina (idempotente)", async () => {
    const created = await subscribeRoute(
      jsonRequest("POST", "http://localhost/api/push/subscribe", {
        subscription: {
          endpoint: "https://push.example/x",
          keys: { p256dh: "k", auth: "a" },
        },
        notifyMinMagnitude: 5,
      })
    );
    expect(created.status).toBe(200);
    expect(countPushSubscriptions()).toBe(1);

    const removed = await unsubscribeRoute(
      jsonRequest("POST", "http://localhost/api/push/unsubscribe", {
        endpoint: "https://push.example/x",
      })
    );
    expect(removed.status).toBe(200);
    expect(countPushSubscriptions()).toBe(0);
  });

  it("subscribe rechaza cuerpos inválidos con 400", async () => {
    const response = await subscribeRoute(
      jsonRequest("POST", "http://localhost/api/push/subscribe", {
        subscription: { endpoint: "no-es-url" },
      })
    );
    expect(response.status).toBe(400);
  });

  it("preferences actualiza el umbral y 404 si no existe", async () => {
    const missing = await preferencesRoute(
      jsonRequest("PUT", "http://localhost/api/push/preferences", {
        endpoint: "https://push.example/nadie",
        notifyMinMagnitude: 5,
      })
    );
    expect(missing.status).toBe(404);

    upsertPushSubscription({ ...subscription("https://push.example/x", 4.5) });
    const updated = await preferencesRoute(
      jsonRequest("PUT", "http://localhost/api/push/preferences", {
        endpoint: "https://push.example/x",
        notifyMinMagnitude: 5.5,
      })
    );
    expect(updated.status).toBe(200);
    expect(listPushSubscriptions()[0]?.notifyMinMagnitude).toBe(5.5);
  });

  it("health reporta push y zonas", async () => {
    upsertPushSubscription({ ...subscription("https://push.example/x", 4.5) });
    const response = await healthGET();
    const body = (await response.json()) as {
      ok: boolean;
      push: { configured: boolean; subscriptions: number };
      zones: number;
    };
    expect(body.ok).toBe(true);
    expect(body.push.configured).toBe(true);
    expect(body.push.subscriptions).toBe(1);
    expect(typeof body.zones).toBe("number");
  });
});
