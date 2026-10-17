/**
 * GET /api/zones — zonas vigiladas del usuario.
 * POST /api/zones — crea una zona (nombre, coordenadas, radio, magnitud).
 */

import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { createZone, listZones } from "@/server/services/zonesService";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ ok: true, zones: listZones() });
  } catch (error) {
    return errorResponse(error, "Error interno al leer las zonas");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }
    const zone = createZone(body);
    return NextResponse.json({ ok: true, zone }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "No fue posible crear la zona");
  }
}
