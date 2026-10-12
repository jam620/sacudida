"use client";

/**
 * Control de tamaño de letra (accesibilidad, inspirado en Tiembla).
 * Escala toda la UI vía font-size del <html> (rem) y se recuerda
 * en localStorage. No envía nada al servidor.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "sacudida.fontsize";

const SIZES = [
  { id: "normal", label: "A", title: "Texto normal" },
  { id: "large", label: "A+", title: "Texto grande" },
  { id: "xlarge", label: "A++", title: "Texto muy grande" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

function isSizeId(value: string | null): value is SizeId {
  return value === "normal" || value === "large" || value === "xlarge";
}

export default function FontSizeControl() {
  const [size, setSize] = useState<SizeId>("normal");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const initial = isSizeId(saved) ? saved : "normal";
    setSize(initial);
    document.documentElement.dataset.fontsize = initial;
  }, []);

  const apply = (next: SizeId) => {
    setSize(next);
    document.documentElement.dataset.fontsize = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin localStorage simplemente no se recuerda la preferencia.
    }
  };

  return (
    <div
      role="group"
      aria-label="Tamaño de letra"
      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1"
    >
      {SIZES.map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.title}
          aria-label={option.title}
          aria-pressed={size === option.id}
          onClick={() => apply(option.id)}
          className={`rounded px-2 py-1 text-xs font-bold ${
            size === option.id
              ? "bg-sky-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
