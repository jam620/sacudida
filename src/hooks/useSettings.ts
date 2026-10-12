"use client";

/**
 * Hook SWR de preferencias de consulta del usuario (GET /api/settings).
 * Solo contiene preferencias de filtros; sin datos personales.
 */

import useSWR from "swr";
import { apiFetcher } from "@/lib/api";
import type { SettingsResponse, UserPreferences } from "@/types/earthquake";

type SettingsOk = Extract<SettingsResponse, { ok: true }>;

export function useSettings(): { settings: UserPreferences | null } {
  const { data } = useSWR<SettingsOk, Error>(
    "/api/settings",
    apiFetcher<SettingsOk>,
    { revalidateOnFocus: false }
  );

  return { settings: data?.settings ?? null };
}
