/**
 * GET /api/earthquakes/stats — resumen de la secuencia sísmica activa:
 * terremoto principal (M >= 6.5 en los últimos 30 días), conteo de
 * réplicas M >= 2.5 posteriores (total, última hora, últimas 24 h) y
 * la última sincronización con USGS en esta instancia.
 */

import { NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import {
  ensureFreshData,
  getAftershockSummary,
  getLastSyncAtIso,
} from "@/server/services/earthquakeService";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    // Mantener la caché fresca (arranque en frío o datos vencidos),
    // igual que la lista principal.
    await ensureFreshData();

    const summary = getAftershockSummary();

    return NextResponse.json({
      ok: true,
      mainshock: summary?.mainshock ?? null,
      aftershocks: summary?.aftershocks ?? null,
      lastSyncAt: getLastSyncAtIso(),
    });
  } catch (error) {
    return errorResponse(error, "Error interno al calcular las réplicas");
  }
}
