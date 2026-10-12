/**
 * Carga mínima de `.env.local` para scripts CLI (tsx no la lee solos).
 * No sobrescribe variables ya presentes en el entorno.
 * Next.js carga `.env.local` por sí mismo en `dev`/`build`/`start`.
 */

import fs from "node:fs";

export function loadEnvLocal(): void {
  let content: string;

  try {
    content = fs.readFileSync(".env.local", "utf8");
  } catch {
    // Sin .env.local se usan los valores por defecto del código.
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
