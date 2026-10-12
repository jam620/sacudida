/**
 * Fetcher compartido para todos los hooks SWR.
 * Garantiza errores con mensajes claros y nunca deja pasar un `ok: false`
 * como si fuera una respuesta exitosa.
 */

type ApiOk = { ok: true } & Record<string, unknown>;

export async function apiFetcher<T extends ApiOk>(url: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      "No fue posible conectar con el servidor. Verifica tu conexión."
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida.");
  }

  const ok =
    typeof payload === "object" &&
    payload !== null &&
    (payload as { ok?: unknown }).ok === true;

  if (!response.ok || !ok) {
    const message = (payload as { message?: unknown }).message;
    throw new Error(
      typeof message === "string" && message.length > 0
        ? message
        : `Error del servidor (HTTP ${response.status}).`
    );
  }

  return payload as T;
}
