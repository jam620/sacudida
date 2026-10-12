/**
 * GET /api/settings — preferencias de consulta del usuario.
 * PUT /api/settings — guarda preferencias (JSON, acepta parciales).
 * Nunca almacena ni devuelve datos personales.
 */

import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import {
  getUserPreferences,
  saveUserPreferences,
} from "@/server/services/settingsService";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ ok: true, settings: getUserPreferences() });
  } catch (error) {
    return errorResponse(error, "Error interno al leer las preferencias");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;

    try {
      const text = await request.text();
      body = text.trim().length > 0 ? JSON.parse(text) : {};
    } catch {
      throw new ValidationError("El cuerpo de la solicitud no es JSON válido");
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("El cuerpo debe ser un objeto JSON");
    }

    const settings = saveUserPreferences(body);

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return errorResponse(error, "Error interno al guardar las preferencias");
  }
}
