/**
 * Service Worker de Sacudida.
 *
 * Estrategias:
 * - API /api/earthquakes*: red primero con timeout; si la red falla,
 *   se sirve la última respuesta buena (fail-safe del contrato).
 * - Estáticos (/_next/static, /icons, manifiesto): stale-while-revalidate.
 * - Navegación: red primero; sin red, página offline.
 * Solo mismo origen y solo GET.
 */

const VERSION = "sacudida-v1";
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const PAGES_CACHE = `${VERSION}-pages`;

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const API_TIMEOUT_MS = 8000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Red primero con respaldo en caché (datos sísmicos). */
async function apiFirstStrategy(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetchWithTimeout(request, API_TIMEOUT_MS);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Sin conexión a internet. No hay datos guardados todavía.",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
}

/** Stale-while-revalidate para estáticos. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await refresh) || Response.error();
}

/** Navegación: red primero, caché de páginas, luego offline. */
async function navigationStrategy(request) {
  const pagesCache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetchWithTimeout(request, API_TIMEOUT_MS);
    if (response.ok) {
      pagesCache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = (await pagesCache.match(request)) || (await pagesCache.match("/"));
    if (cached) {
      return cached;
    }
    const offline = await caches.match("/offline.html");
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(apiFirstStrategy(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
  }
});
