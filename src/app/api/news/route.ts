/**
 * GET /api/news — noticias de la emergencia agregadas del RSS público de
 * Google Noticias (título, imagen, resumen, medio y fecha), con caché de
 * 5 minutos. Fail-safe: si los feeds fallan devuelve lista vacía.
 */

import { NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import { getNews } from "@/server/services/newsService";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const { items, updatedAt } = await getNews();

    return NextResponse.json({
      ok: true,
      updatedAt: new Date(updatedAt).toISOString(),
      items,
    });
  } catch (error) {
    return errorResponse(error, "Error interno al consultar las noticias");
  }
}
