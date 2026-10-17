/**
 * PATCH /api/zones/[id] — modifica una zona (nombre, radio, activación…).
 * DELETE /api/zones/[id] — elimina la zona.
 */

import { NextResponse } from "next/server";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { removeZone, updateZone } from "@/server/services/zonesService";

export const dynamic = "force-dynamic";

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("ID de zona inválido");
  }
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }
    const zone = updateZone(parseId(id), body);
    if (zone === null) {
      throw new NotFoundError("Zona no encontrada");
    }
    return NextResponse.json({ ok: true, zone });
  } catch (error) {
    return errorResponse(error, "No fue posible actualizar la zona");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const deleted = removeZone(parseId(id));
    if (!deleted) {
      throw new NotFoundError("Zona no encontrada");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "No fue posible eliminar la zona");
  }
}
