/**
 * Servicio de preferencias de usuario (tabla `app_settings`).
 * Solo guarda preferencias de consulta; jamás datos personales
 * ni geolocalización (CLAUDE.md, principio de privacidad).
 */

import { z } from "zod";
import {
  DEFAULT_DAYS,
  DEFAULT_MIN_MAGNITUDE,
  DEFAULT_ORDER_BY,
  MAX_DAYS,
  MAX_MAGNITUDE_LIMIT,
  MIN_MAGNITUDE_LIMIT,
  RELEVANT_MAGNITUDE,
} from "@/lib/constants";
import { ValidationError } from "@/lib/errors";
import type { OrderBy } from "@/types/earthquake";
import type { UserPreferences } from "@/types/earthquake";
import { getSettingValue, setSettingValue } from "../repositories/settingsRepository";

const KEYS = {
  minMagnitude: "preferences.minMagnitude",
  days: "preferences.days",
  orderBy: "preferences.orderBy",
  notifyMinMagnitude: "preferences.notifyMinMagnitude",
} as const;

const FullPreferencesSchema = z.object({
  minMagnitude: z.coerce
    .number()
    .min(MIN_MAGNITUDE_LIMIT)
    .max(MAX_MAGNITUDE_LIMIT),
  days: z.coerce.number().int().min(1).max(MAX_DAYS),
  orderBy: z.enum(["time", "magnitude"]),
  notifyMinMagnitude: z.coerce.number().min(1).max(MAX_MAGNITUDE_LIMIT),
});

const PartialPreferencesSchema = z
  .object({
    minMagnitude: z.coerce.number().min(MIN_MAGNITUDE_LIMIT).max(MAX_MAGNITUDE_LIMIT).optional(),
    days: z.coerce.number().int().min(1).max(MAX_DAYS).optional(),
    orderBy: z.enum(["time", "magnitude"]).optional(),
    notifyMinMagnitude: z.coerce.number().min(1).max(MAX_MAGNITUDE_LIMIT).optional(),
  })
  .strict();

const DEFAULT_PREFERENCES: UserPreferences = {
  minMagnitude: DEFAULT_MIN_MAGNITUDE,
  days: DEFAULT_DAYS,
  orderBy: DEFAULT_ORDER_BY,
  notifyMinMagnitude: RELEVANT_MAGNITUDE,
};

function readNumber(key: string, fallback: number): number {
  const raw = getSettingValue(key);
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readOrderBy(key: string, fallback: OrderBy): OrderBy {
  const raw = getSettingValue(key);
  return raw === "time" || raw === "magnitude" ? raw : fallback;
}

/** Preferencias actuales combinadas con los valores por defecto. */
export function getUserPreferences(): UserPreferences {
  return {
    minMagnitude: readNumber(KEYS.minMagnitude, DEFAULT_PREFERENCES.minMagnitude),
    days: Math.round(readNumber(KEYS.days, DEFAULT_PREFERENCES.days)),
    orderBy: readOrderBy(KEYS.orderBy, DEFAULT_PREFERENCES.orderBy),
    notifyMinMagnitude: readNumber(
      KEYS.notifyMinMagnitude,
      DEFAULT_PREFERENCES.notifyMinMagnitude
    ),
  };
}

/**
 * Valida y guarda preferencias parciales o completas.
 * Lanza `ValidationError` con un mensaje claro si algo no es válido.
 */
export function saveUserPreferences(input: unknown): UserPreferences {
  const parsed = PartialPreferencesSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue
      ? `${issue.path.join(".") || "valor"}: ${issue.message}`
      : "formato no reconocido";
    throw new ValidationError(`Preferencias inválidas (${detail})`);
  }

  const candidate = { ...getUserPreferences(), ...parsed.data };
  const validated = FullPreferencesSchema.safeParse(candidate);

  if (!validated.success) {
    const issue = validated.error.issues[0];
    const detail = issue
      ? `${issue.path.join(".") || "valor"}: ${issue.message}`
      : "formato no reconocido";
    throw new ValidationError(`Preferencias inválidas (${detail})`);
  }

  const preferences: UserPreferences = {
    minMagnitude: validated.data.minMagnitude,
    days: validated.data.days,
    orderBy: validated.data.orderBy,
    notifyMinMagnitude: validated.data.notifyMinMagnitude,
  };

  setSettingValue(KEYS.minMagnitude, String(preferences.minMagnitude));
  setSettingValue(KEYS.days, String(preferences.days));
  setSettingValue(KEYS.orderBy, preferences.orderBy);
  setSettingValue(KEYS.notifyMinMagnitude, String(preferences.notifyMinMagnitude));

  return preferences;
}
