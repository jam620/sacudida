import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: debe resolverse en Node.js,
  // no empaquetarse por el bundler de servidor de Next.js.
  serverExternalPackages: ["better-sqlite3"],
  // Garantiza que schema.sql viaje con las funciones serverless en Vercel
  // (se lee en tiempo de ejecución con fs.readFileSync).
  outputFileTracingIncludes: {
    "/api/**": ["./src/server/database/schema.sql"],
  },
};

export default nextConfig;
