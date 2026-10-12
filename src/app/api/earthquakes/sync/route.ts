/**
 * POST /api/earthquakes/sync — sincroniza desde USGS hacia SQLite.
 * Body opcional JSON: { days?: 1–30, minMagnitude?: 0–10 }.
 * Fallos de USGS se responden con 502; validaciones con 400.
 */

import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/errors";
import { importUsgsEarthquakes } from "@/server/etl/usgsImporter";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

type SyncBody = { days?: unknown; minMagnitude?: unknown };

function parseBody(body: SyncBody): { days: number; minMagnitude: number } {
  const days = body.days === undefined ? 7 : Number(body.days);
  const minMagnitude = body.minMagnitude === undefined ? 2.5 : Number(body.minMagnitude);

  if (!Number.isFinite(days) || days < 1 || days > 30) {
    throw new ValidationError("days debe ser un número entre 1 y 30");
  }
  if (!Number.isFinite(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
    throw new ValidationError("minMagnitude debe ser un número entre 0 y 10");
  }

  return { days: Math.round(days), minMagnitude };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: SyncBody = {};

    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          body = parsed as SyncBody;
        }
      }
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }

    const { days, minMagnitude } = parseBody(body);

    const result = await importUsgsEarthquakes({ days, minMagnitude });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "No fue posible sincronizar con USGS");
  }
}
