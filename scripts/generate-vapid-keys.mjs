/**
 * Genera un par de claves VAPID para Web Push y las agrega a .env.local
 * si aún no existen. Uso: node scripts/generate-vapid-keys.mjs
 *
 * La clave pública debe exponerse al cliente (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 * y la privada nunca sale del servidor (VAPID_PRIVATE_KEY).
 */

import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";

const ENV_PATH = path.join(process.cwd(), ".env.local");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

const lines = [
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateKey}`,
  'VAPID_SUBJECT=mailto:contacto@sacudida.example',
];

let env = "";
try {
  env = fs.readFileSync(ENV_PATH, "utf8");
} catch {
  // Sin .env.local todavía.
}

const missing = lines.filter((line) => {
  const key = line.slice(0, line.indexOf("="));
  return !new RegExp(`^${key}=`, "m").test(env);
});

if (missing.length === 0) {
  console.log("Las claves VAPID ya existen en .env.local; no se cambian.");
  process.exit(0);
}

const next = `${env.trimEnd()}\n\n# Web Push (VAPID)\n${missing.join("\n")}\n`;
fs.writeFileSync(ENV_PATH, next);

console.log(`Claves VAPID generadas y escritas en ${ENV_PATH}:`);
for (const line of missing) {
  const key = line.slice(0, line.indexOf("="));
  console.log(`  ${key}=${key.endsWith("PUBLIC_KEY") ? line.slice(key.length + 1) : "(valor privado)"}`);
}
console.log("\nAjusta VAPID_SUBJECT a tu correo real antes de producción.");
