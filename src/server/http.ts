/**
 * Traducción de errores tipados a respuestas HTTP JSON.
 * Regla (docs/06): 400 entrada inválida, 404 inexistente,
 * 502 fallo de proveedor externo, 500 interno. Nunca se exponen
 * stack traces ni detalles internos en los mensajes.
 */

import { NextResponse } from "next/server";
import {
  NotFoundError,
  UpstreamError,
  ValidationError,
  errorMessage,
} from "@/lib/errors";

export function errorResponse(
  error: unknown,
  fallbackMessage = "Error interno del servidor"
): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
  }
  if (error instanceof UpstreamError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  }

  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    // En desarrollo se registra el detalle completo en el log del servidor,
    // pero la respuesta al cliente sigue siendo un mensaje genérico.
    console.error(`[api] ${error.name}: ${errorMessage(error, fallbackMessage)}`);
  }

  return NextResponse.json(
    { ok: false, message: fallbackMessage },
    { status: 500 }
  );
}
