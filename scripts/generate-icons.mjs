/**
 * Generador de iconos PWA de Sacudida (sin dependencias externas).
 * Produce PNG RGBA válidos con un encoder mínimo (zlib de Node).
 *
 * Diseño: fondo azul oscuro con degradado radial, anillos concéntricos
 * cian (ondas sísmicas) y núcleo rojo (epicentro).
 *
 * Uso: node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const iconsDir = path.join(rootDir, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// ---------- Encoder PNG mínimo ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, pixelAt) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filtro None
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Diseño ----------

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Cobertura suave de una banda de anillo (antialiasing). */
function bandCoverage(distance, radius, halfWidth) {
  return clamp01(halfWidth - Math.abs(distance - radius) + 0.5);
}

function mix(bg, fg, alpha) {
  return [
    Math.round(bg[0] + (fg[0] - bg[0]) * alpha),
    Math.round(bg[1] + (fg[1] - bg[1]) * alpha),
    Math.round(bg[2] + (fg[2] - bg[2]) * alpha),
  ];
}

/**
 * pixelAt en coordenadas 512x512 lógicas.
 * rounded: esquinas transparentes (icono "any"). scale: escala del motivo.
 */
function drawIcon({ rounded, scale, opaque }) {
  return (px, py, size) => {
    const x = (px / size) * 512;
    const y = (py / size) * 512;

    // Máscara de esquina redondeada (radio 112 en base 512).
    let maskAlpha = 1;
    if (rounded) {
      const radius = 112;
      const cx = Math.min(Math.max(x, radius), 512 - radius);
      const cy = Math.min(Math.max(y, radius), 512 - radius);
      const dx = x - cx;
      const dy = y - cy;
      maskAlpha = clamp01(radius - Math.hypot(dx, dy) + 0.5);
    }

    // Fondo con degradado radial (centro más claro).
    const d = Math.hypot(x - 256, y - 256);
    const t = clamp01(d / 340);
    let color = mix([24, 44, 82], [4, 7, 14], t * t);

    // Anillos sísmicos cian, del interior al exterior.
    const cyan = [56, 189, 248];
    const rings = [
      { radius: 88 * scale, half: 8, alpha: 0.95 },
      { radius: 150 * scale, half: 8, alpha: 0.7 },
      { radius: 212 * scale, half: 8, alpha: 0.45 },
    ];
    for (const ring of rings) {
      color = mix(color, cyan, bandCoverage(d, ring.radius, ring.half) * ring.alpha);
    }

    // Núcleo rojo (epicentro).
    const coreRadius = 42 * scale;
    const coreCoverage = clamp01(coreRadius - d + 0.5);
    if (coreCoverage > 0) {
      color = mix(color, [239, 68, 68], coreCoverage);
    }

    const alpha = opaque ? 255 : Math.round(maskAlpha * 255);
    return [color[0], color[1], color[2], alpha];
  };
}

function renderIcon(file, size, options) {
  const pixelBase = drawIcon(options);
  const buffer = encodePng(size, size, (x, y) => pixelBase(x, y, size));
  writeFileSync(path.join(iconsDir, file), buffer);
  console.log(`Generado ${file} (${size}x${size}, ${(buffer.length / 1024).toFixed(1)} KB)`);
}

renderIcon("icon-192.png", 192, { rounded: true, scale: 1, opaque: false });
renderIcon("icon-512.png", 512, { rounded: true, scale: 1, opaque: false });
renderIcon("icon-maskable-192.png", 192, { rounded: false, scale: 0.78, opaque: true });
renderIcon("icon-maskable-512.png", 512, { rounded: false, scale: 0.78, opaque: true });
renderIcon("apple-touch-icon.png", 180, { rounded: false, scale: 1, opaque: true });

// Favicon de Next (ruta automática src/app/icon.png).
copyFileSync(
  path.join(iconsDir, "apple-touch-icon.png"),
  path.join(rootDir, "src", "app", "icon.png")
);
console.log("Copiado src/app/icon.png (favicon automático de Next)");
