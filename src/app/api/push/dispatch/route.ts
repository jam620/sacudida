/**
 * GET/POST /api/push/dispatch — sincroniza con USGS y envía los avisos
 * push de los eventos nuevos. Pensado para el cron de Vercel o un
 * scheduler externo (con la pestaña cerrada no hay quién sondee).
 *
 * Autenticación: `Authorization: Bearer $CRON_SECRET` (el cron de Vercel
 * lo envía solo) o `?token=$PUSH_DISPATCH_TOKEN`. En desarrollo se
 * permite sin token para probar a mano.
 */

import { NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import { syncAndDispatchPush } from "@/server/services/earthquakeService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const dispatchToken = process.env.PUSH_DISPATCH_TOKEN;

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const header = request.headers.get("authorization");
  if (cronSecret && header === `Bearer ${cronSecret}`) {
    return true;
  }
  const token = new URL(request.url).searchParams.get("token");
  if (dispatchToken && token === dispatchToken) {
    return true;
  }
  return false;
}

async function handle(request: Request): Promise<NextResponse> {
  try {
    if (!authorized(request)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 401 }
      );
    }

    const result = await syncAndDispatchPush();

    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      sent: result.sent,
      expired: result.expired,
      errors: result.errors,
      skipped: result.skipped,
      reason: result.reason ?? null,
    });
  } catch (error) {
    return errorResponse(error, "No fue posible despachar los avisos");
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request);
}
