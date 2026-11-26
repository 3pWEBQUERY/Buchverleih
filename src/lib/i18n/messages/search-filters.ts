import type { Locale } from "../locale";

/** Schnellfilter direkt unter dem Suchfeld (Suche) */
const de = {
  label: "Schnellfilter",
  freeToday: "Heute frei",
  near: "≤ 2 km",
  nearHint: "Höchstens 2 Kilometer entfernt",
  byPost: "Per Post",
  inCircle: "Im Kreis",
  inCircleHint: "Nur Bücher aus deinen Kreisen",
};
type M = typeof de;

const fr: M = {
  label: "Filtres rapides",
  freeToday: "Libre aujourd’hui",
  near: "≤ 2 km",
  nearHint: "À 2 kilomètres au plus",
  byPost: "Par la poste",
  inCircle: "Dans mes cercles",
  inCircleHint: "Seulement les livres de tes cercles",
};

const it: M = {
  label: "Filtri rapidi",
  freeToday: "Libero oggi",
  near: "≤ 2 km",
  nearHint: "Al massimo 2 chilometri",
  byPost: "Per posta",
  inCircle: "Nella cerchia",
  inCircleHint: "Solo libri delle tue cerchie",
};

const en: M = {
  label: "Quick filters",
  freeToday: "Free today",
  near: "≤ 2 km",
  nearHint: "At most 2 kilometres away",
  byPost: "By post",
  inCircle: "In my circles",
  inCircleHint: "Only books from your circles",
};

export const SEARCH_FILTERS: Record<Locale, M> = { de, fr, it, en };
