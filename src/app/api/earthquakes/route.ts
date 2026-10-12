/**
 * GET /api/earthquakes — lista de eventos filtrada.
 * Query params: minMagnitude (0–10, default 2.5), days (1–30, default 7),
 * orderBy ("time" | "magnitude", default "time").
 */

import { NextResponse } from "next/server";
import {
  getEarthquakesWithAutoSync,
  parseFilters,
} from "@/server/services/earthquakeService";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const filters = parseFilters({
      minMagnitude: searchParams.get("minMagnitude"),
      days: searchParams.get("days"),
      orderBy: searchParams.get("orderBy"),
    });

    const earthquakes = await getEarthquakesWithAutoSync(filters);

    return NextResponse.json({
      ok: true,
      count: earthquakes.length,
      source: "sqlite",
      filters,
      earthquakes,
    });
  } catch (error) {
    return errorResponse(error, "Error interno al consultar sismos");
  }
}
