/**
 * PUT /api/push/preferences — umbral de magnitud de una suscripción.
 * 404 si la suscripción no existe (debe suscribirse primero).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { updatePushPreferences } from "@/server/repositories/pushRepository";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  endpoint: z.string().url().max(2048),
  notifyMinMagnitude: z.number().min(2).max(8),
});

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Preferencias de push inválidas");
    }

    const updated = updatePushPreferences(
      parsed.data.endpoint,
      parsed.data.notifyMinMagnitude
    );
    if (!updated) {
      throw new NotFoundError("Suscripción no encontrada");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "No fue posible guardar las preferencias de push");
  }
}
