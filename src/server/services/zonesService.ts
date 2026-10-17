/**
 * Servicio de zonas vigiladas: validación (Zod) y acceso al repositorio.
 * Una zona es un punto elegido por el usuario (hogar, trabajo…) con radio
 * y magnitud mínima; los avisos push solo se envían si el evento entra.
 */

import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import type { WatchedZone, WatchedZoneInput } from "@/types/alerts";
import {
  createWatchedZone,
  deleteWatchedZone,
  listWatchedZones,
  updateWatchedZone,
} from "../repositories/zonesRepository";

export const RADIUS_OPTIONS_KM = [25, 50, 100, 200] as const;
export const ZONE_MAGNITUDE_OPTIONS = [3, 3.5, 4, 4.5, 5] as const;

const LatitudeSchema = z.coerce.number().min(-90).max(90);
const LongitudeSchema = z.coerce.number().min(-180).max(180);

export const WatchedZoneInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la zona no puede estar vacío")
    .max(40, "El nombre de la zona es demasiado largo"),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  radiusKm: z.coerce.number().min(10).max(1000),
  minMagnitude: z.coerce.number().min(2).max(8),
  active: z.boolean().optional(),
});

export const WatchedZonePatchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  latitude: LatitudeSchema.optional(),
  longitude: LongitudeSchema.optional(),
  radiusKm: z.coerce.number().min(10).max(1000).optional(),
  minMagnitude: z.coerce.number().min(2).max(8).optional(),
  active: z.boolean().optional(),
});

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? issue.message : "Datos de zona inválidos";
}

export function listZones(): WatchedZone[] {
  return listWatchedZones();
}

export function createZone(input: unknown): WatchedZone {
  const parsed = WatchedZoneInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(`Zona inválida: ${firstIssueMessage(parsed.error)}`);
  }
  return createWatchedZone(parsed.data as WatchedZoneInput);
}

export function updateZone(id: number, patch: unknown): WatchedZone | null {
  const parsed = WatchedZonePatchSchema.safeParse(patch);
  if (!parsed.success) {
    throw new ValidationError(`Zona inválida: ${firstIssueMessage(parsed.error)}`);
  }
  return updateWatchedZone(id, parsed.data);
}

export function removeZone(id: number): boolean {
  return deleteWatchedZone(id);
}
