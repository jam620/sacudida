"use client";

/**
 * Hook SWR de la lista de sismos (modo en vivo).
 * Refresca cada POLL_INTERVAL_MS y conserva los datos anteriores mientras
 * carga una actualización (docs/07).
 */

import useSWR from "swr";
import type { MutatorCallback } from "swr/_internal";
import { apiFetcher } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type {
  Earthquake,
  EarthquakeFilters,
  EarthquakesResponse,
} from "@/types/earthquake";

type EarthquakesOk = Extract<EarthquakesResponse, { ok: true }>;

export function useEarthquakes(filters: EarthquakeFilters) {
  const params = new URLSearchParams({
    minMagnitude: String(filters.minMagnitude),
    days: String(filters.days),
    orderBy: filters.orderBy,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    EarthquakesOk,
    Error
  >(`/api/earthquakes?${params.toString()}`, apiFetcher<EarthquakesOk>, {
    refreshInterval: POLL_INTERVAL_MS,
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  return {
    earthquakes: data?.earthquakes ?? null,
    count: data?.count ?? 0,
    error: error instanceof Error ? error.message : null,
    isLoading,
    isValidating,
    mutate: mutate as (
      update?: Earthquake[] | MutatorCallback<EarthquakesOk> | undefined,
      options?: { revalidate?: boolean }
    ) => Promise<EarthquakesOk | undefined>,
  };
}
