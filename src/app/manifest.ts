import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE, LEGAL_NOTICE } from "@/lib/constants";

/**
 * Manifiesto PWA: hace que Sacudida sea instalable desde el navegador
 * (Android/Chrome vía beforeinstallprompt, iOS vía "Añadir a inicio").
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: `${APP_TAGLINE}. ${LEGAL_NOTICE}`,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "es",
    categories: ["news", "utilities", "weather"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
