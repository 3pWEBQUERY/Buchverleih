/**
 * Erzeugt die PNG-Icons der PWA aus public/icons/icon.svg (Kachel) und public/brand/logo.svg (Logo im Kopf).
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
// Maskierbar: Bücher auf 80 % verkleinert, damit sie in der sicheren Zone liegen (Kachel 1254)
const maskable = svg.replace('<g id="mark">', '<g id="mark" transform="translate(125.4 125.4) scale(0.8)">');
// Badge (Android): nur die Form, weiss auf transparent
const badge = svg
  .replace(/<rect width="1254" height="1254" fill="#000"\/>/, "")
  .replace(/fill="#(FFF3D7|E51E09)"/g, 'fill="#fff"')
  .replace(/fill="#000"/g, 'fill="#000" class="cut"')
  .replace("<g id=\"mark\">", '<mask id="m"><rect width="1254" height="1254" fill="#fff"/></mask><g id="mark">');

const jobs = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", svg, 180],
];

for (const [name, source, size] of jobs) {
  await sharp(Buffer.from(source), { density: Math.ceil((72 * size) / 512) * 2 })
    .resize(size, size)
    .flatten({ background: "#000000" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, name));
  console.log(`${name} ${size}×${size}`);
}

// Badge 96: Bänder als Lücken (schwarze Flächen werden transparent)
{
  const { data, info } = await sharp(Buffer.from(badge), { density: 72 }).resize(96, 96).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.min(data[i + 3], v);
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(path.join(dir, "badge-96.png"));
  console.log("badge-96.png 96×96");
}

// Logo im Kopf und für das Social-Media-Bild (192 px, transparent um die abgerundete Kachel)
const brand = path.join(dir, "..", "brand");
await sharp(path.join(brand, "logo.svg"), { density: 72 }).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(brand, "logo.png"));
console.log("brand/logo.png 192×192");
