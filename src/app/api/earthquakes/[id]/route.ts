/**
 * GET /api/earthquakes/[id] — detalle de un evento por su ID de USGS.
 * Devuelve 200 con el evento, 400 si el ID está vacío o 404 si no existe.
 */

import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { getEarthquake } from "@/server/services/earthquakeService";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { ok: false, message: "El ID del evento es requerido" },
        { status: 400 }
      );
    }

    const earthquake = getEarthquake(id);

    if (earthquake === null) {
      throw new NotFoundError("Evento no encontrado");
    }

    return NextResponse.json({ ok: true, earthquake });
  } catch (error) {
    return errorResponse(error, "Error interno al consultar el evento");
  }
}
