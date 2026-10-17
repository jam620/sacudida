/**
 * POST /api/push/subscribe — registra (o refresca) una suscripción Web Push.
 * El cuerpo es la PushSubscription del navegador + umbral opcional.
 * La app re-envía la suscripción en cada apertura: en serverless la base
 * es efímera y esto la mantiene viva en la instancia activa.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { upsertPushSubscription } from "@/server/repositories/pushRepository";
import { isPushConfigured } from "@/server/services/pushService";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    }),
  }),
  notifyMinMagnitude: z.number().min(2).max(8).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!isPushConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Los avisos push no están configurados en el servidor (faltan claves VAPID).",
        },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Suscripción push inválida");
    }

    const stored = upsertPushSubscription({
      endpoint: parsed.data.subscription.endpoint,
      p256dh: parsed.data.subscription.keys.p256dh,
      auth: parsed.data.subscription.keys.auth,
      notifyMinMagnitude: parsed.data.notifyMinMagnitude,
    });

    return NextResponse.json({ ok: true, subscription: stored });
  } catch (error) {
    return errorResponse(error, "No fue posible registrar la suscripción");
  }
}
