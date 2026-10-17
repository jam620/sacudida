"use client";

/**
 * Zonas vigiladas: puntos elegidos por el usuario (hogar, trabajo, otra)
 * con radio y magnitud mínima. Los avisos push solo se envían cuando el
 * evento entra en una zona activa. La ubicación en vivo nunca se guarda:
 * solo se usa para rellenar el formulario al crear la zona.
 */

import { useState } from "react";
import useSWR from "swr";
import { apiFetcher } from "@/lib/api";
import { NOTICE_DISCLAIMER } from "@/lib/noticeLabels";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useUserLocation } from "@/hooks/useUserLocation";
import type { WatchedZone } from "@/types/alerts";

type ZonesOk = Extract<{ ok: true; zones: WatchedZone[] }, { ok: true }>;

const RADIUS_OPTIONS = [25, 50, 100, 200];
const MAGNITUDE_OPTIONS = [3, 3.5, 4, 4.5, 5];

export default function WatchedZones() {
  const { data, mutate } = useSWR<ZonesOk, Error>("/api/zones", apiFetcher<ZonesOk>);
  const { coords, status: locationStatus, request: requestLocation } = useUserLocation();
  const push = usePushSubscription();

  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [minMagnitude, setMinMagnitude] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const zones = data?.zones ?? [];

  async function handleCreate(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Mi zona",
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusKm,
          minMagnitude,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message ?? "No fue posible guardar la zona.");
      }
      setName("");
      await mutate();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "No fue posible guardar la zona."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(zone: WatchedZone): Promise<void> {
    await fetch(`/api/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !zone.active }),
    }).catch(() => undefined);
    await mutate();
  }

  async function handleDelete(zone: WatchedZone): Promise<void> {
    await fetch(`/api/zones/${zone.id}`, { method: "DELETE" }).catch(
      () => undefined
    );
    await mutate();
  }

  const canCreate =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude.trim() !== "" &&
    longitude.trim() !== "";

  return (
    <section
      aria-labelledby="zonas-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
    >
      <h2 id="zonas-titulo" className="text-base font-semibold text-slate-100">
        Zonas vigiladas
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Elige puntos (hogar, trabajo…) con su radio y magnitud mínima: los
        avisos push solo se envían si un sismo entra en una zona activa. Sin
        zonas configuradas se aplica tu umbral general. {NOTICE_DISCLAIMER}
      </p>

      <ul className="mt-3 flex flex-col gap-2" role="list">
        {zones.map((zone) => (
          <li
            key={zone.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-slate-100">{zone.name}</span>
            <span className="text-xs text-slate-400">
              {zone.latitude.toFixed(3)}, {zone.longitude.toFixed(3)} · radio{" "}
              {zone.radiusKm} km · desde M {zone.minMagnitude}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleToggle(zone)}
                aria-pressed={zone.active}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  zone.active
                    ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/50"
                    : "bg-slate-800 text-slate-400 ring-1 ring-slate-700"
                }`}
              >
                {zone.active ? "Activa" : "Pausada"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(zone)}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Borrar
              </button>
            </span>
          </li>
        ))}
        {zones.length === 0 ? (
          <li className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
            Aún no tienes zonas. Crea una con tu ubicación actual o con
            coordenadas manuales.
          </li>
        ) : null}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Nombre
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hogar, trabajo…"
            maxLength={40}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={requestLocation}
            disabled={locationStatus === "requesting"}
            className="w-full rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locationStatus === "requesting"
              ? "Obteniendo ubicación…"
              : "Usar mi ubicación actual"}
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Latitud
          <input
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="8.5"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Longitud
          <input
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="-80.5"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </label>
        {coords !== null &&
        latitude !== String(coords.latitude) &&
        longitude !== String(coords.longitude) ? (
          <button
            type="button"
            onClick={() => {
              setLatitude(String(coords.latitude));
              setLongitude(String(coords.longitude));
            }}
            className="rounded-lg border border-emerald-700/60 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 sm:col-span-2"
          >
            Rellenar con {coords.latitude.toFixed(4)},{" "}
            {coords.longitude.toFixed(4)}
          </button>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Radio (km)
          <select
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {RADIUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} km
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Avisar desde
          <select
            value={minMagnitude}
            onChange={(event) => setMinMagnitude(Number(event.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {MAGNITUDE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                M {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!canCreate || busy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Añadir zona"}
        </button>

        {push.supported && push.configured ? (
          push.subscribed ? (
            <span className="text-xs font-medium text-emerald-300">
              Avisos push activos en este dispositivo
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void push.enable()}
              disabled={push.busy}
              className="rounded-lg border border-emerald-600/60 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {push.busy ? "Activando…" : "Activar avisos push (app cerrada)"}
            </button>
          )
        ) : (
          <span className="text-xs text-slate-500">
            {push.supported
              ? "Los avisos push requieren claves VAPID en el servidor."
              : "Este navegador no soporta avisos push."}
          </span>
        )}
        {push.error ? (
          <span role="alert" className="text-xs text-amber-300">
            {push.error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
