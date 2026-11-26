import type { Locale } from "@/lib/i18n/locale";

/** Texte des öffentlichen Bewertungsprofils */
const de = {
  title: "Bewertungen",
  desc: "Was andere nach abgeschlossenen Leihen zurückgemeldet haben. Ohne Sterne und ohne Buchtitel.",
  count: (n: number) => (n === 1 ? "1 Bewertung" : `${n} Bewertungen`),
  none: (name: string | null) => (name ? `${name} hat noch keine Bewertungen.` : "Du hast noch keine Bewertungen."),
  noneHint: "Bewertungen erscheinen, sobald beide Seiten nach einer Leihe geantwortet haben.",
  goodShare: "Lief gut",
  asLender: "Beim Verleihen",
  asBorrower: "Beim Leihen",
  ofSide: (good: number, total: number) => (total ? `${good} von ${total} lief gut` : "noch keine"),
  reasonsTitle: "Wenn es Probleme gab",
  noProblems: "Bisher keine Probleme gemeldet.",
  recent: "Letzte Bewertungen",
  good: "Lief gut",
  problems: "Gab Probleme",
  roleLender: "hat verliehen",
  roleBorrower: "hat geliehen",
  from: (name: string | null) => (name ? `von ${name}` : "von einem gelöschten Konto"),
};
type M = typeof de;

const fr: M = {
  title: "Évaluations",
  desc: "Ce que les autres ont indiqué après des prêts terminés. Sans étoiles ni titres de livres.",
  count: (n) => (n === 1 ? "1 évaluation" : `${n} évaluations`),
  none: (name) => (name ? `${name} n’a pas encore d’évaluations.` : "Tu n’as pas encore d’évaluations."),
  noneHint: "Les évaluations apparaissent dès que les deux personnes ont répondu après un prêt.",
  goodShare: "Bien passé",
  asLender: "En prêtant",
  asBorrower: "En empruntant",
  ofSide: (good, total) => (total ? `${good} sur ${total} bien passés` : "aucune pour l’instant"),
  reasonsTitle: "En cas de problème",
  noProblems: "Aucun problème signalé jusqu’ici.",
  recent: "Dernières évaluations",
  good: "Bien passé",
  problems: "Il y a eu des problèmes",
  roleLender: "a prêté",
  roleBorrower: "a emprunté",
  from: (name) => (name ? `de ${name}` : "d’un compte supprimé"),
};

const it: M = {
  title: "Valutazioni",
  desc: "Ciò che altri hanno segnalato dopo prestiti conclusi. Senza stelle e senza titoli di libri.",
  count: (n) => (n === 1 ? "1 valutazione" : `${n} valutazioni`),
  none: (name) => (name ? `${name} non ha ancora valutazioni.` : "Non hai ancora valutazioni."),
  noneHint: "Le valutazioni appaiono quando entrambe le parti hanno risposto dopo un prestito.",
  goodShare: "Andato bene",
  asLender: "Prestando",
  asBorrower: "Prendendo in prestito",
  ofSide: (good, total) => (total ? `${good} su ${total} andati bene` : "ancora nessuna"),
  reasonsTitle: "Quando ci sono stati problemi",
  noProblems: "Finora nessun problema segnalato.",
  recent: "Ultime valutazioni",
  good: "Andato bene",
  problems: "Ci sono stati problemi",
  roleLender: "ha prestato",
  roleBorrower: "ha preso in prestito",
  from: (name) => (name ? `da ${name}` : "da un account eliminato"),
};

const en: M = {
  title: "Ratings",
  desc: "What others said after finished loans. No stars and no book titles.",
  count: (n) => (n === 1 ? "1 rating" : `${n} ratings`),
  none: (name) => (name ? `${name} has no ratings yet.` : "You have no ratings yet."),
  noneHint: "Ratings appear once both sides have answered after a loan.",
  goodShare: "Went well",
  asLender: "When lending",
  asBorrower: "When borrowing",
  ofSide: (good, total) => (total ? `${good} of ${total} went well` : "none yet"),
  reasonsTitle: "When there were problems",
  noProblems: "No problems reported so far.",
  recent: "Latest ratings",
  good: "Went well",
  problems: "There were problems",
  roleLender: "lent",
  roleBorrower: "borrowed",
  from: (name) => (name ? `from ${name}` : "from a deleted account"),
};

export const RATINGS: Record<Locale, M> = { de, fr, it, en };
