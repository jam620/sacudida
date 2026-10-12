/**
 * Avisos sonoros para sismos nuevos (modo en vivo).
 *
 * - Tonos sintetizados con Web Audio: sin archivos ni dependencias.
 * - Los navegadores exigen un gesto del usuario antes de reproducir
 *   audio: el contexto se desbloquea con el primer clic/toque en la
 *   página (o al activar el sonido en ajustes).
 * - No requiere permisos del sistema operativo: suena mientras la
 *   pestaña esté abierta. Nunca lanza excepciones.
 */

type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const Candidate =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: AudioContextConstructor })
        .webkitAudioContext;

    if (!Candidate) {
      return null;
    }

    audioContext ??= new Candidate();
    return audioContext;
  } catch {
    return null;
  }
}

/** Desbloquea/reanuda el audio (llamar tras un gesto del usuario). */
export function unlockAudio(): boolean {
  const context = getContext();
  if (context === null) {
    return false;
  }
  try {
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

function tone(
  context: AudioContext,
  startAt: number,
  durationMs: number,
  frequencyHz: number,
  volume: number
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencyHz, startAt);

  // Envolvente suave para evitar clics.
  const attack = 0.012;
  const release = 0.06;
  const end = startAt + durationMs / 1000;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack);
  gain.gain.setValueAtTime(volume, Math.max(startAt + attack, end - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(end + 0.02);
}

/**
 * Reproduce el aviso sonoro. `urgent: true` (M >= 5.5) usa un tono más
 * agudo y repetido. Devuelve `true` solo si se pudo programar el sonido.
 */
export function playAlertSound(options: { urgent?: boolean } = {}): boolean {
  const context = getContext();
  if (context === null) {
    return false;
  }

  try {
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const now = context.currentTime + 0.03;

    if (options.urgent) {
      // Tres pitidos agudos: atención inmediata.
      tone(context, now, 140, 988, 0.22);
      tone(context, now + 0.2, 140, 988, 0.22);
      tone(context, now + 0.4, 220, 1319, 0.25);
    } else {
      // Dos pitidos suaves de "evento nuevo".
      tone(context, now, 130, 740, 0.16);
      tone(context, now + 0.18, 170, 880, 0.18);
    }

    return true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  // Desbloqueo del audio con el primer gesto del usuario en la página.
  window.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
    },
    { once: true, passive: true }
  );
}
