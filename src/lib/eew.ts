/**
 * Interfaz de proveedor de Alerta Temprana de Sismos (EEW) y un
 * proveedor SIMULADO para modo demostración.
 *
 * Regla crítica del producto: Sacudida NO tiene alerta temprana real. Un
 * EEW real detecta el sismo y avisa ANTES de que lleguen las ondas; eso
 * solo puede provenir de una autoridad con red sísmica en tiempo real.
 * Este módulo deja la integración preparada para:
 * - Google Android Earthquake Alerts (hoy sin API pública de third-party),
 * - una red sísmica nacional (p. ej. IGC-UP si publica EEW), o
 * - un proveedor EEW autorizado por convenio.
 * Hasta que exista, el único proveedor es el simulacro, claramente
 * etiquetado y sin envío de notificaciones.
 */

export type EarlyWarning = {
  /** Escala de magnitud del evento detectado. */
  magnitude: number;
  /** Descripción del epicentro. */
  place: string;
  /** Segundos estimados hasta la llegada de las ondas S. */
  etaSeconds: number;
  /** Intensidad esperada (MMI aprox., IV–IX). */
  expectedIntensityMmi: number;
  /** Instrucción estándar; en Panamá se difunde en español. */
  instruction: string;
  /** Siempre "demostracion" en el simulacro; "real" solo con autoridad. */
  mode: "demostracion" | "real";
  sourceLabel: string;
};

export type EarlyWarningStatus = {
  /** Estado del proveedor conectado. */
  connected: boolean;
  /** "demostracion" hasta que una autoridad real se integre. */
  mode: "demostracion" | "real" | "sin-proveedor";
  providerName: string;
  note?: string;
};

export interface EarthquakeEarlyWarningProvider {
  subscribe(location: { latitude: number; longitude: number }): Promise<void>;
  onWarning(callback: (warning: EarlyWarning) => void): () => void;
  getWarningStatus(): Promise<EarlyWarningStatus>;
}

export const EEW_INSTRUCTION = "Agáchate, cúbrete y sujétate.";

/** Proveedor simulado — SOLO para simulacros, nunca envía avisos reales. */
export class SimulatedEewProvider implements EarthquakeEarlyWarningProvider {
  private listeners = new Set<(warning: EarlyWarning) => void>();
  private location: { latitude: number; longitude: number } | null = null;

  async subscribe(location: { latitude: number; longitude: number }): Promise<void> {
    this.location = { ...location };
  }

  onWarning(callback: (warning: EarlyWarning) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async getWarningStatus(): Promise<EarlyWarningStatus> {
    return {
      connected: true,
      mode: "demostracion",
      providerName: "Simulacro Sacudida",
      note:
        "Modo demostración: ningún proveedor de alerta temprana está " +
        "integrado. Sacudida no emite alertas tempranas.",
    };
  }

  /**
   * Dispara un simulacro (solo desde un clic del usuario en la UI).
   * La ubicación suscrita solo afecta al ETA del ejemplo.
   */
  triggerDemoWarning(): void {
    const distanceKmAprox = 45;
    const etaSeconds = Math.max(5, Math.round(distanceKmAprox / 3.5));
    const warning: EarlyWarning = {
      magnitude: 6.4,
      place: "Ejemplo: 40 km al sur de Tonosí, Los Santos",
      etaSeconds,
      expectedIntensityMmi: 6,
      instruction: EEW_INSTRUCTION,
      mode: "demostracion",
      sourceLabel: "SIMULACRO — no es un evento real",
    };
    for (const listener of this.listeners) {
      listener(warning);
    }
  }
}
