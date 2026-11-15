// MapLibre ab v6 lädt seinen Web Worker als eigene Datei. Der Bundler kopiert sie nicht mit,
// deshalb legen wir sie vor dem Build/Dev-Start unter public/vendor ab (nicht im Repository).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
mkdirSync("public/vendor", { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
console.log("maplibre-gl-worker.mjs → public/vendor");
