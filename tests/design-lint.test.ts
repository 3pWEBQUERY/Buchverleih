import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hält das Designsystem zusammen: Schrift, Radius, Gewicht, Laufweite und Dauer kommen nur aus
 * der Skala in globals.css (@theme). Neue Arbiträrwerte wie text-[13.5px] oder rounded-[10px]
 * lehnt dieser Test ab. Ausnahmen sind benannt und begründet – nicht stillschweigend.
 */
const SRC = path.resolve(__dirname, "../src");

/** Dateien, in denen die Gestalt aus dem Inhalt gerechnet wird (kein Token kann das abbilden) */
const ALLOW: Record<string, string> = {
  "components/cover.tsx": "Ersatzcover: Schrift skaliert mit der Covergrösse",
  "components/spine.tsx": "Buchrücken: Masse aus dem Titel abgeleitet",
  "components/loan/handover-code.tsx": "QR-Ansicht: feste helle Werte und Sekundentakt der Restzeit",
  "app/opengraph-image.tsx": "Vorschaubild: wird ausserhalb des Browsers gezeichnet",
  "app/(main)/landing.tsx": "Miniatur-Cover in der Illustration (6.5 px im verkleinerten Buch)",
};

const RULES: [name: string, re: RegExp, hint: string][] = [
  ["Schriftgrösse", /(?<![\w-])text-\[[\d.]+(px|rem|em)\]/, "text-caption … text-hero"],
  ["Tailwind-Standardgrösse", /(?<![\w-])text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/, "text-caption … text-hero"],
  ["Radius", /(?<![\w-])rounded(-[a-z]{1,2})?-\[[\d.]+px\]/, "rounded-xs · sm · md · lg · full"],
  ["Gewicht", /(?<![\w-])font-\[\d+\]/, "font-medium · font-title · font-semibold"],
  ["Laufweite", /(?<![\w-])tracking-\[[^\]]+\]/, "tracking-ui · title · display · caps · code"],
  ["Dauer", /(?<![\w-])duration-(\d+|\[[^\]]+\])/, "duration-instant · fast · base · slow"],
  ["Kurve", /(?<![\w-])ease-(\[[^\]]+\]|in-out)(?![\w-])/, "ease-out · ease-in · ease-spring"],
  ["transition-all", /(?<![\w-])transition-all(?![\w-])/, "nur die Eigenschaften nennen, die sich ändern"],
  ["Schatten", /(?<![\w-])(drop-)?shadow-(xs|sm|md|lg|xl|2xl|\[)/, "keine Schatten – Flächen und Haarlinien trennen"],
  ["Verlaufstext", /bg-clip-text/, "kein Gradient-Text"],
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) return files(p);
    return /\.(tsx|ts)$/.test(f.name) ? [p] : [];
  });
}

describe("Designsystem: keine Arbiträrwerte", () => {
  const found: string[] = [];
  for (const file of files(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    if (rel.startsWith("lib/i18n/messages/")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [name, re, hint] of RULES) {
        const m = re.exec(line);
        if (!m) continue;
        if (ALLOW[rel]) continue;
        found.push(`${rel}:${i + 1}  ${name} «${m[0]}» → ${hint}`);
      }
    });
  }

  it("Schrift, Radius, Gewicht, Laufweite, Dauer nur aus der Skala", () => {
    expect(found, `\n${found.join("\n")}\n`).toEqual([]);
  });

  it("jede Ausnahme zeigt auf eine vorhandene Datei", () => {
    for (const rel of Object.keys(ALLOW)) expect(() => readFileSync(path.join(SRC, rel)), rel).not.toThrow();
  });
});
