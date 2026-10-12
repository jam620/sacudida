"use client";

/**
 * Hook SWR del resumen de réplicas (GET /api/earthquakes/stats).
 * Refresca al mismo ritmo en vivo que la lista principal.
 */

import useSWR from "swr";
import { apiFetcher } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { AftershockStatsResponse } from "@/types/earthquake";

type StatsOk = Extract<AftershockStatsResponse, { ok: true }>;

export function useAftershockStats() {
  const { data } = useSWR<StatsOk, Error>(
    "/api/earthquakes/stats",
    apiFetcher<StatsOk>,
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true }
  );

  return {
    mainshock: data?.mainshock ?? null,
    aftershocks: data?.aftershocks ?? null,
  };
}
