import { describe, expect, it } from "vitest";
import tokens from "@/styles/tokens.json";
import { loadAndCheck } from "../scripts/tokens-check";

/**
 * Kontrast nach WCAG 2.2 AA, gerechnet aus den Tokens in hell und dunkel.
 * Text braucht 4.5:1, Ränder von Bedienelementen 3:1 (1.4.11). Wer ein Token ändert oder
 * ein neues Paar in der Oberfläche einführt, trägt es hier ein – der Test hält die Grenze.
 */
type Mode = Record<string, string>;

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text auf Fläche: jede Kombination, die in der Oberfläche vorkommt */
const TEXT: [text: string, surfaces: string[]][] = [
  ["ink", ["paper", "paper2", "paper3", "accentSoft"]],
  ["ink2", ["paper", "paper2", "paper3"]],
  // Gedämpfter Text steht auch auf Hover-Flächen und der aktiven Tab-Marke (paper3)
  ["muted", ["paper", "paper2", "paper3"]],
  ["accentHover", ["paper", "paper2", "accentSoft"]],
  ["accentInk", ["accent", "accentHover"]],
  ["statusOk", ["paper", "paper2"]],
  ["statusLent", ["paper", "paper2"]],
  ["statusLate", ["paper", "paper2"]],
  ["statusWait", ["paper", "paper2"]],
  ["statusDone", ["paper", "paper2"]],
  // Kalenderbalken und Schritt-Knoten: Papierfarbe auf Status- und Tintenflächen
  ["paper", ["statusLent", "statusLate", "statusWait", "ink2", "ink"]],
  ["nightInk", ["night", "night2"]],
  ["nightMuted", ["night", "night2"]],
];

/** Ränder und Zustände von Bedienelementen: mindestens 3:1 zur umgebenden Fläche */
const NON_TEXT: [fg: string, surfaces: string[]][] = [
  ["fieldBorder", ["paper", "paper2", "paper3"]],
  ["accent", ["paper", "paper2"]],
  ["ink", ["paper", "paper2"]],
];

describe("Kontrast der Tokens (WCAG 2.2 AA)", () => {
  for (const [name, mode] of Object.entries(tokens.color) as [string, Mode][]) {
    describe(name === "light" ? "hell" : "dunkel", () => {
      for (const [text, surfaces] of TEXT) {
        for (const s of surfaces) {
          it(`Text ${text} auf ${s} ≥ 4.5`, () => {
            expect(mode[text], `Token ${text} fehlt`).toBeTruthy();
            expect(mode[s], `Token ${s} fehlt`).toBeTruthy();
            expect(contrast(mode[text], mode[s])).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
      for (const [fg, surfaces] of NON_TEXT) {
        for (const s of surfaces) {
          it(`Rand ${fg} auf ${s} ≥ 3`, () => {
            expect(contrast(mode[fg], mode[s])).toBeGreaterThanOrEqual(3);
          });
        }
      }
    });
  }

  it("Statusfarben auf der dunklen Bühne (in beiden Modi gleich hell)", () => {
    const night = [tokens.color.light.night, tokens.color.light.night2, tokens.color.dark.night, tokens.color.dark.night2];
    for (const c of ["#8fd09a", "#f0c060", "#ff8aa3", "#a9bfe3"]) for (const n of night) expect(contrast(c, n)).toBeGreaterThanOrEqual(4.5);
  });

  it("Übergabe-Code: feste Grautöne auf Weiss (QR-Ansicht ist absichtlich immer hell)", () => {
    // Werte aus src/components/loan/handover-code.tsx
    expect(contrast("#525252", "#ffffff")).toBeGreaterThanOrEqual(4.5); // Hinweistexte
    expect(contrast("#000000", "#f5f5f5")).toBeGreaterThanOrEqual(4.5); // Ziffern auf Kachel
  });
});

describe("Token-Abgleich", () => {
  it("globals.css und tokens.json stimmen überein", () => {
    expect(loadAndCheck()).toEqual([]);
  });
});
