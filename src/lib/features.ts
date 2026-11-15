/**
 * Funktionsschalter für die ganze Plattform (Moderation › Schalter). Server-seitig durchgesetzt:
 * Eine abgeschaltete Funktion verschwindet aus der Oberfläche und die API lehnt sie ab.
 */
import { cache } from "react";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";

export const FEATURES = ["swap", "pass_on", "wishlist", "map", "shipping"] as const;
export type Feature = (typeof FEATURES)[number];
export type Features = Record<Feature, boolean>;

async function load(): Promise<Features> {
  const rows = await sql<{ key: Feature; enabled: boolean }[]>`select key, enabled from features`;
  const out = Object.fromEntries(FEATURES.map((k) => [k, true])) as Features;
  for (const r of rows) out[r.key] = r.enabled;
  return out;
}

/** Pro Anfrage einmal gelesen */
export const features = cache(load);

const OFF: Record<Feature, string> = {
  swap: "Tauschen und Verschenken ist gerade ausgeschaltet.",
  pass_on: "Die direkte Weitergabe ist gerade ausgeschaltet.",
  wishlist: "Die Wunschliste ist gerade ausgeschaltet.",
  map: "Die Karte ist gerade ausgeschaltet.",
  shipping: "Versand ist gerade ausgeschaltet.",
};

export async function requireFeature(key: Feature) {
  if (!(await features())[key]) throw err.forbidden(OFF[key]);
}
