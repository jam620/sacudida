import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSummary,
  decodeEntities,
  parseRssItems,
  stripHtml,
} from "@/lib/rss";
import { GET } from "@/app/api/news/route";
import {
  getNews,
  resetNewsCacheForTests,
} from "@/server/services/newsService";
import type { NewsResponse } from "@/types/news";

const originalFetch = globalThis.fetch;

function feedXml(items: string): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>prueba</title>${items}</channel></rss>`;
}

function itemXml(overrides: {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  source?: string;
  sourceUrl?: string;
  description?: string;
}): string {
  const source = overrides.source
    ? `<source url="${overrides.sourceUrl ?? "https://medio.example"}">${overrides.source}</source>`
    : "";
  return (
    "<item>" +
    `<title>${overrides.title ?? "Sismo de prueba en Panamá"}</title>` +
    `<link>${overrides.link ?? "https://medio.example/a/1"}</link>` +
    `<guid isPermaLink="false">${overrides.guid ?? "guid-1"}</guid>` +
    `<pubDate>${overrides.pubDate ?? "Sun, 12 Oct 2026 12:00:00 GMT"}</pubDate>` +
    `<description>${overrides.description ?? "&lt;p&gt;Resumen &amp;amp; del sismo&lt;/p&gt;"}</description>` +
    `${source}</item>`
  );
}

describe("parseRssItems", () => {
  it("extrae título, enlace, fuente, fecha y descripción", () => {
    const xml = feedXml(
      itemXml({
        title: "Temblor en Panamá - TVN",
        source: "TVN",
        sourceUrl: "https://www.tvn-2.com/",
      })
    );

    const items = parseRssItems(xml);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Temblor en Panamá - TVN");
    expect(items[0]?.link).toBe("https://medio.example/a/1");
    expect(items[0]?.sourceName).toBe("TVN");
    expect(items[0]?.sourceUrl).toBe("https://www.tvn-2.com/");
    expect(items[0]?.pubDateMs).toBe(Date.parse("Sun, 12 Oct 2026 12:00:00 GMT"));
  });

  it("descarta items sin título o enlace y tolera CDATA", () => {
    const xml =
      feedXml(
        itemXml({ title: "<![CDATA[Terremoto M6 en la frontera]]>" }) +
          "<item><title>Sin enlace</title></item>"
      );

    const items = parseRssItems(xml);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Terremoto M6 en la frontera");
  });
});

describe("stripHtml / buildSummary / decodeEntities", () => {
  it("limpia etiquetas y entidades", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
    expect(stripHtml("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
    expect(stripHtml("<a href='x'>ver</a> más")).toBe("ver más");
  });

  it("elimina enlaces que llegan codificados como entidades (bug del href visible)", () => {
    // Así viene la descripción en el RSS de Google Noticias.
    const description =
      "&lt;a href='https://news.google.com/rss/articles/xyz'&gt;Titular de prueba&lt;/a&gt;" +
      "&nbsp;&nbsp;&lt;font color='#6f6f6f'&gt;TVN&lt;/font&gt;";
    const clean = stripHtml(description);
    expect(clean).toBe("Titular de prueba TVN");
    expect(clean).not.toContain("href");
    expect(clean).not.toContain("<");
    expect(clean).not.toContain("&lt;");
  });

  it("resume con límite y elipsis en palabra", () => {
    const long = "palabra ".repeat(40).trim();
    const summary = buildSummary(long, 60);
    expect(summary.length).toBeLessThanOrEqual(62);
    expect(summary.endsWith("…")).toBe(true);
    expect(buildSummary("corto", 60)).toBe("corto");
  });
});

describe("getNews", () => {
  beforeEach(() => {
    resetNewsCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetNewsCacheForTests();
  });

  function mockFeedsAndImages(callCount: { value: number }) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      callCount.value += 1;

      if (url.includes("news.google.com")) {
        const xml = feedXml(
          itemXml({
            title: "Réplica fuerte en Tonosí - Telemetro",
            guid: "g1",
            link: "https://medio.example/a/repl",
            pubDate: "Mon, 12 Oct 2026 14:00:00 GMT",
            source: "Telemetro",
          }) +
          itemXml({
            title: "Escuelas suspendidas - Crítica",
            guid: "g2",
            link: "https://medio.example/a/esc",
            pubDate: "Mon, 12 Oct 2026 10:00:00 GMT",
            source: "Crítica",
          })
        );
        return new Response(xml, { status: 200 });
      }

      // Páginas de artículo con og:image y variante twitter:image.
      if (url.includes("medio.example/a/repl")) {
        return new Response(
          '<html><head><meta property="og:image" content="https://img.example/foto.jpg"></head></html>',
          { status: 200 }
        );
      }
      if (url.includes("medio.example")) {
        return new Response(
          '<html><head><meta name="twitter:image" content="https://img.example/tw.jpg"></head></html>',
          { status: 200 }
        );
      }

      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;
  }

  it("agrega, deduplica, ordena y extrae imágenes", async () => {
    const calls = { value: 0 };
    mockFeedsAndImages(calls);

    const { items } = await getNews();

    expect(items.length).toBeGreaterThanOrEqual(2);
    // Orden: más reciente primero.
    expect(items[0]?.id).toBe("g1");
    expect(items[0]?.source).toBe("Telemetro");
    // El sufijo " - Telemetro" se separó del titular.
    expect(items[0]?.title).toBe("Réplica fuerte en Tonosí");
    // Imagen enriquecida desde og:image.
    expect(items[0]?.imageUrl).toBe("https://img.example/foto.jpg");
    // Fallback a twitter:image cuando no hay og:image.
    expect(items[1]?.imageUrl).toBe("https://img.example/tw.jpg");
    // Resumen limpio de HTML.
    expect(items[0]?.summary).toContain("Resumen");
  });

  it("usa caché: la segunda llamada no repite fetch", async () => {
    const calls = { value: 0 };
    mockFeedsAndImages(calls);

    await getNews();
    const first = calls.value;
    await getNews();

    expect(calls.value).toBe(first);
  });

  it("fail-safe: feeds caídos devuelven lista vacía sin lanzar", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const { items } = await getNews();

    expect(items).toEqual([]);
  });
});

describe("GET /api/news", () => {
  beforeEach(() => {
    resetNewsCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetNewsCacheForTests();
  });

  it("devuelve el envelope con items", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("news.google.com")) {
        return new Response(
          feedXml(
            itemXml({ title: "Sismo sentido en Azuero - La Prensa", guid: "n1", source: "La Prensa" })
          ),
          { status: 200 }
        );
      }
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;

    const response = await GET();
    const body = (await response.json()) as NewsResponse;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(Date.parse(body.updatedAt))).toBe(true);
      expect(body.items[0]?.source).toBe("La Prensa");
    }
  });

  it("responde lista vacía controlada si los feeds fallan", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const response = await GET();
    const body = (await response.json()) as NewsResponse;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.items).toEqual([]);
    }
  });
});
