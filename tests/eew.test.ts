import { describe, expect, it } from "vitest";
import {
  EEW_INSTRUCTION,
  SimulatedEewProvider,
} from "@/lib/eew";
import type { EarlyWarning } from "@/lib/eew";
import {
  NOTICE_DISCLAIMER,
  NOTICE_LABELS,
  NOTICE_SHORT_LABELS,
} from "@/lib/noticeLabels";

describe("SimulatedEewProvider", () => {
  it("getWarningStatus siempre declara modo demostración", async () => {
    const provider = new SimulatedEewProvider();
    const status = await provider.getWarningStatus();
    expect(status.mode).toBe("demostracion");
    expect(status.connected).toBe(true);
    expect(status.note).toContain("no emite alertas tempranas");
  });

  it("onWarning recibe el simulacro y unsubscribe deja de recibirlo", () => {
    const provider = new SimulatedEewProvider();
    const received: number[] = [];

    const unsubscribe = provider.onWarning((warning) => {
      received.push(warning.etaSeconds);
    });
    provider.triggerDemoWarning();
    unsubscribe();
    provider.triggerDemoWarning();

    expect(received).toHaveLength(1);
  });

  it("el simulacro trae instrucción, ETA e intensidad esperada", async () => {
    const provider = new SimulatedEewProvider();
    await provider.subscribe({ latitude: 8.5, longitude: -80.5 });

    const captured: { warning: EarlyWarning | null } = { warning: null };
    provider.onWarning((incoming) => {
      captured.warning = incoming;
    });
    provider.triggerDemoWarning();

    expect(captured.warning).not.toBeNull();
    expect(captured.warning?.etaSeconds).toBeGreaterThan(0);
    expect(captured.warning?.instruction).toBe(EEW_INSTRUCTION);
    expect(captured.warning?.expectedIntensityMmi).toBeGreaterThanOrEqual(1);
    expect(captured.warning?.mode).toBe("demostracion");
  });
});

describe("etiquetado de avisos", () => {
  it("los tres tipos tienen etiqueta y el descargo es el pactado", () => {
    expect(NOTICE_LABELS.info).toBe("Información sísmica");
    expect(NOTICE_LABELS["post-event"]).toBe(
      "Aviso posterior a la publicación del sismo"
    );
    expect(NOTICE_LABELS["eew-confirmed"]).toContain("Alerta temprana confirmada");
    expect(NOTICE_DISCLAIMER).toBe(
      "Sacudida no predice sismos. No es una alerta oficial."
    );
    expect(NOTICE_SHORT_LABELS["post-event"]).not.toBe(NOTICE_LABELS["eew-confirmed"]);
  });
});
