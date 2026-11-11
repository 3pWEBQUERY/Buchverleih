"use client";
import { useEffect } from "react";

/**
 * Darstellung Hell, Dunkel oder System (PRD 8.1: Dunkelmodus von Anfang an).
 * Die Wahl liegt nur im Browser (localStorage). «System» entfernt das Attribut,
 * dann gilt prefers-color-scheme aus globals.css.
 */
export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "lr-theme";

const META_COLOR = { light: "#f6f2ea", dark: "#13120e" } as const;

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
  // Adressleiste/Statusleiste mitfärben
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    if (m.dataset.orig === undefined) m.dataset.orig = m.content;
    m.content = t === "system" ? m.dataset.orig : META_COLOR[t];
  });
}

export function saveTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // Speicher blockiert: Wahl gilt nur für diese Seite
  }
  applyTheme(t);
}

/** Im Root-Layout einbinden: übernimmt die gespeicherte Wahl und folgt Änderungen aus anderen Tabs. */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === THEME_KEY) applyTheme(readTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
