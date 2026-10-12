"use client";

/**
 * Mapa Leaflet de eventos sísmicos.
 * - Marcadores circulares: color según magnitud (M4+ amarillo, M5+ naranja,
 *   M6+ rojo, resto azul claro) y tamaño proporcional.
 * - Altura mínima de 500 px en escritorio (docs/07).
 */

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { PANAMA_CENTER } from "@/lib/constants";
import {
  MAGNITUDE_COLORS,
  formatDepth,
  formatMagnitude,
  formatPanamaDateTime,
  magnitudeLevel,
  magnitudeRadius,
} from "@/lib/format";
import type { Earthquake } from "@/types/earthquake";

type EarthquakeMapProps = {
  earthquakes: Earthquake[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Centra el mapa en el evento seleccionado desde la lista. */
function FocusSelected({
  earthquakes,
  selectedId,
}: Pick<EarthquakeMapProps, "earthquakes" | "selectedId">) {
  const map = useMap();
  const selected = selectedId
    ? earthquakes.find((earthquake) => earthquake.id === selectedId)
    : undefined;

  useEffect(() => {
    if (selected) {
      map.setView(
        [selected.latitude, selected.longitude],
        Math.max(map.getZoom(), 7)
      );
    }
  }, [map, selected]);

  return null;
}

export default function EarthquakeMap({
  earthquakes,
  selectedId,
  onSelect,
}: EarthquakeMapProps) {
  return (
    <div
      role="region"
      aria-label="Mapa de sismos cercanos a Panamá"
      className="h-[380px] overflow-hidden rounded-xl border border-slate-800 lg:h-[560px]"
    >
      <MapContainer
        center={[PANAMA_CENTER.latitude, PANAMA_CENTER.longitude]}
        zoom={7}
        minZoom={5}
        maxZoom={12}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {earthquakes.map((earthquake) => {
          const level = magnitudeLevel(earthquake.magnitude);
          const isSelected = earthquake.id === selectedId;

          return (
            <CircleMarker
              key={earthquake.id}
              center={[earthquake.latitude, earthquake.longitude]}
              radius={magnitudeRadius(earthquake.magnitude)}
              pathOptions={{
                color: isSelected ? "#f8fafc" : MAGNITUDE_COLORS[level],
                weight: isSelected ? 3 : 1.5,
                fillColor: MAGNITUDE_COLORS[level],
                fillOpacity: 0.85,
              }}
              eventHandlers={{
                click: () => onSelect(earthquake.id),
              }}
            >
              <Popup>
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold">
                    M {formatMagnitude(earthquake.magnitude)} —{" "}
                    {earthquake.place}
                  </p>
                  <p>
                    {formatPanamaDateTime(earthquake.time)} (hora de Panamá)
                  </p>
                  <p>
                    Profundidad: {formatDepth(earthquake.depthKm)} · Fuente:{" "}
                    {earthquake.source}
                  </p>
                  <p>
                    <a
                      href={earthquake.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      Ver evento en USGS
                    </a>
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        <FocusSelected earthquakes={earthquakes} selectedId={selectedId} />
      </MapContainer>
    </div>
  );
}
