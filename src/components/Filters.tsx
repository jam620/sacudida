"use client";

/**
 * Filtros de consulta: magnitud mínima, periodo y orden.
 * Accesibles por teclado, con etiquetas explícitas (docs/07).
 */

import { useState } from "react";
import { MAX_DAYS } from "@/lib/constants";
import type { EarthquakeFilters, OrderBy } from "@/types/earthquake";

const MAGNITUDE_OPTIONS = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6];

const DAY_OPTIONS = [1, 3, 7, 14, 30].filter((days) => days <= MAX_DAYS);

const ORDER_OPTIONS: Array<{ value: OrderBy; label: string }> = [
  { value: "time", label: "Más recientes" },
  { value: "magnitude", label: "Mayor magnitud" },
];

type FiltersProps = {
  filters: EarthquakeFilters;
  onChange: (next: EarthquakeFilters) => void;
  onSavePreferences: () => Promise<string>;
};

export default function Filters({
  filters,
  onChange,
  onSavePreferences,
}: FiltersProps) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const changeMinMagnitude = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onChange({ ...filters, minMagnitude: parsed });
  };

  const changeDays = (value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return;
    }
    onChange({ ...filters, days: parsed });
  };

  const changeOrderBy = (value: string) => {
    if (value === "time" || value === "magnitude") {
      onChange({ ...filters, orderBy: value });
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaveMessage(null);
    const message = await onSavePreferences();
    setSaveMessage(message);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-min-magnitude"
            className="text-sm font-semibold text-slate-200"
          >
            Magnitud mínima
          </label>
          <select
            id="filter-min-magnitude"
            value={String(filters.minMagnitude)}
            onChange={(event) => changeMinMagnitude(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500"
          >
            {MAGNITUDE_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                M {option.toFixed(1)} o más
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-days"
            className="text-sm font-semibold text-slate-200"
          >
            Periodo
          </label>
          <select
            id="filter-days"
            value={String(filters.days)}
            onChange={(event) => changeDays(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500"
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                Últimos {option} {option === 1 ? "día" : "días"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-order"
            className="text-sm font-semibold text-slate-200"
          >
            Orden
          </label>
          <select
            id="filter-order"
            value={filters.orderBy}
            onChange={(event) => changeOrderBy(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500"
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={savePreferences}
          disabled={saving}
          className="rounded-lg border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar como preferencias"}
        </button>
        {saveMessage ? (
          <span role="status" className="text-xs text-slate-300">
            {saveMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}
