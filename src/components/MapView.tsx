"use client";

/**
 * Envoltorio del mapa con carga dinámica y SSR desactivado:
 * Leaflet requiere `window` y no puede renderizarse en el servidor.
 */

import dynamic from "next/dynamic";
import type { Earthquake } from "@/types/earthquake";

const EarthquakeMap = dynamic(() => import("./EarthquakeMap"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="flex h-[380px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 lg:h-[560px]"
    >
      Cargando mapa…
    </div>
  ),
});

type MapViewProps = {
  earthquakes: Earthquake[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function MapView(props: MapViewProps) {
  return <EarthquakeMap {...props} />;
}
