/**
 * Erzeugt die PNG-Icons der PWA aus public/icons/icon.svg.
 * Aufruf: node scripts/icons.mjs
 * - icon-192.png, icon-512.png: «any», volle Fläche
 * - icon-maskable-512.png: Zeichen auf 80 % verkleinert, damit es in der sicheren Zone liegt
 * - apple-touch-icon.png (180): ohne Transparenz
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const svg = await readFile(path.join(dir, "icon.svg"), "utf8");
const maskable = svg.replace('<g id="mark" fill="#1b1a17">', '<g id="mark" fill="#1b1a17" transform="translate(51.2 51.2) scale(0.8)">');

const jobs = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", svg, 180],
];

for (const [name, source, size] of jobs) {
  await sharp(Buffer.from(source), { density: Math.ceil((72 * size) / 512) * 2 })
    .resize(size, size)
    .flatten({ background: "#141413" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, name));
  console.log(`${name} ${size}×${size}`);
}
