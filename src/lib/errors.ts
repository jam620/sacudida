/**
 * Errores tipados compartidos. Permiten que las rutas HTTP traduzcan
 * fallos a códigos de estado sin exponer detalles internos ni stack traces.
 */

/** Entrada inválida del cliente → HTTP 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Recurso solicitado inexistente → HTTP 404. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Fallo de un proveedor externo (por ejemplo, USGS) → HTTP 502. */
export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** Convierte un error desconocido en mensaje seguro (sin stack trace). */
export function errorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
