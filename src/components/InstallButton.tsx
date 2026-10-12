"use client";

/**
 * Botón "Instalar app" (PWA). Aparece solo cuando el navegador ofrece
 * el flujo de instalación (Chrome/Edge/Android vía beforeinstallprompt).
 * Si ya está instalada, no se muestra.
 */

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setHidden(true);
      return;
    }

    setHidden(false);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || deferredPrompt === null) {
    return null;
  }

  const install = async () => {
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // El usuario puede cancelar el diálogo del navegador.
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <button
      type="button"
      onClick={install}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
    >
      ⬇ Instalar app
    </button>
  );
}
