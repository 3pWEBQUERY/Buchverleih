/**
 * Gleicht die Design-Tokens ab: src/app/globals.css (Web) gegen src/styles/tokens.json (iOS und Doku).
 * Läuft in der CI (`npm run tokens:check`) und als Test. Weicht ein Wert ab, schlägt der Lauf fehl –
 * so kann keine der beiden Dateien still auseinanderlaufen.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Tokens = {
  color: { light: Record<string, string>; dark: Record<string, string> };
  font: { serif: string; sans: string };
  type: Record<string, { size: number; sizeWide: number; lineHeight: number; tracking: number; weight: number } | string>;
  radius: Record<string, number>;
  motion: { duration: Record<string, number>; easing: Record<string, string> };
};

/** paper2 → paper-2, statusOk → st-ok, fieldBorder → field-border */
export function cssName(key: string) {
  return key
    .replace(/^status/, "st")
    .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a}-${b.toLowerCase()}`)
    .replace(/([a-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

/** Deklarationen eines Blocks, der mit `header` beginnt (bis zur schliessenden Klammer derselben Ebene) */
function block(css: string, header: string, from = 0) {
  const at = css.indexOf(header, from);
  if (at < 0) return null;
  const open = css.indexOf("{", at + header.length - 1);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return { body: css.slice(open + 1, i), end: i };
  }
  return null;
}

function decls(body: string) {
  const out = new Map<string, string>();
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

export function checkTokens(css: string, tokens: Tokens): string[] {
  const errors: string[] = [];
  const need = (map: Map<string, string>, name: string, want: string, where: string) => {
    const got = map.get(name);
    if (got === undefined) errors.push(`${where}: ${name} fehlt in globals.css (tokens.json: ${want})`);
    else if (norm(got) !== norm(want)) errors.push(`${where}: ${name} ist ${got} in globals.css, aber ${want} in tokens.json`);
  };

  // Farben hell: erster :root-Block
  const light = block(css, ":root {");
  if (!light) return ["globals.css: kein :root-Block gefunden"];
  const lightMap = decls(light.body);
  for (const [k, v] of Object.entries(tokens.color.light)) need(lightMap, `--${cssName(k)}`, v, "hell");

  // Farben dunkel: gewählte Darstellung und Systemeinstellung müssen beide stimmen – und gleich sein
  const darkAttr = block(css, ':root[data-theme="dark"] {');
  const darkMedia = block(css, ':root:not([data-theme="light"]) {');
  if (!darkAttr || !darkMedia) errors.push("globals.css: dunkler Block fehlt (data-theme oder prefers-color-scheme)");
  else {
    const a = decls(darkAttr.body);
    const b = decls(darkMedia.body);
    for (const [k, v] of Object.entries(tokens.color.dark)) {
      need(a, `--${cssName(k)}`, v, "dunkel (data-theme)");
      need(b, `--${cssName(k)}`, v, "dunkel (System)");
    }
    for (const [k, v] of a) if (b.get(k) !== v) errors.push(`dunkel: ${k} unterscheidet sich zwischen data-theme (${v}) und System (${b.get(k) ?? "fehlt"})`);
  }

  // Skalen: zweiter :root-Block (Schrift, Dauer, Kurven), Medienabfrage für die breiten Grössen, @theme
  const scale = block(css, ":root {", light.end);
  const wide = block(css, "@media (min-width: 768px) {", light.end);
  const theme = block(css, "@theme inline {");
  const spring = block(css, "@supports (transition-timing-function: linear(0, 1)) {");
  if (!scale || !wide || !theme || !spring) return [...errors, "globals.css: Skalen-Block, Medienabfrage, @supports oder @theme fehlt"];
  const s = decls(scale.body);
  const w = decls(wide.body);
  const t = decls(theme.body);

  for (const [name, def] of Object.entries(tokens.type)) {
    if (typeof def === "string") continue;
    need(s, `--fs-${name}`, `${def.size}px`, "Schrift");
    if (def.sizeWide !== def.size) need(w, `--fs-${name}`, `${def.sizeWide}px`, "Schrift ab 768 px");
    else if (w.has(`--fs-${name}`)) errors.push(`Schrift: --fs-${name} hat in globals.css eine breite Grösse, in tokens.json nicht`);
    need(t, `--text-${name}`, `var(--fs-${name})`, "@theme");
    need(t, `--text-${name}--line-height`, String(def.lineHeight), "@theme");
    need(t, `--text-${name}--letter-spacing`, `${def.tracking}em`, "@theme");
  }
  for (const k of t.keys()) {
    const m = /^--text-([a-z-]+)$/.exec(k);
    if (m && !m[1].includes("--") && !(m[1] in tokens.type)) errors.push(`@theme: ${k} steht nicht in tokens.json`);
  }

  for (const [k, v] of Object.entries(tokens.radius)) need(t, `--radius-${k}`, `${v}px`, "Radius");
  for (const k of t.keys()) {
    const m = /^--radius-([a-z]+)$/.exec(k);
    if (m && !(m[1] in tokens.radius)) errors.push(`@theme: ${k} steht nicht in tokens.json`);
  }

  for (const [k, v] of Object.entries(tokens.motion.duration)) {
    need(s, `--dur-${k}`, `${v}ms`, "Bewegung");
    need(t, `--transition-duration-${k}`, `var(--dur-${k})`, "@theme");
  }
  need(s, "--ease-out-curve", tokens.motion.easing.out, "Bewegung");
  need(s, "--ease-in-curve", tokens.motion.easing.in, "Bewegung");
  need(s, "--ease-spring-curve", tokens.motion.easing.springFallback, "Bewegung");
  need(decls(spring.body), "--ease-spring-curve", tokens.motion.easing.spring, "Bewegung (linear)");

  for (const [k, v] of Object.entries(tokens.font)) {
    const got = t.get(`--font-${k}`) ?? "";
    if (!got.includes(`"${v} Variable"`)) errors.push(`Schriftfamilie: --font-${k} (${got}) nennt nicht «${v}» aus tokens.json`);
  }
  return errors;
}

export function loadAndCheck() {
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const tokens = JSON.parse(readFileSync(path.join(root, "src/styles/tokens.json"), "utf8")) as Tokens;
  return checkTokens(css, tokens);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = loadAndCheck();
  if (errors.length) {
    console.error(`Tokens laufen auseinander (${errors.length}):\n` + errors.map((e) => `  · ${e}`).join("\n"));
    process.exit(1);
  }
  console.log("Tokens stimmen überein: globals.css ↔ tokens.json");
}
