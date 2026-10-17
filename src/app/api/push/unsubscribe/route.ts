/**
 * POST /api/push/unsubscribe — elimina una suscripción (idempotente).
 * Se llama al desactivar los avisos y cuando el navegador la da de baja.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { deletePushSubscription } from "@/server/repositories/pushRepository";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Falta el endpoint de la suscripción");
    }

    deletePushSubscription(parsed.data.endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "No fue posible eliminar la suscripción");
  }
}
