/**
 * Texte der Oberfläche (Deutsch, Schweizer Rechtschreibung, Du-Form, ohne Ausrufezeichen).
 * Weitere Sprachen (FR, IT, EN) entstehen als Dateien mit derselben Struktur.
 */
import type { LoanStatus, OfferKind } from "@/lib/loans/machine";

export const conditionLabel: Record<number, string> = {
  1: "Wie neu",
  2: "Gut",
  3: "Gelesen",
  4: "Stark gebraucht",
};

export const conditionHint: Record<number, string> = {
  1: "Keine Lesespuren",
  2: "Leichte Lesespuren, Rücken intakt",
  3: "Deutliche Lesespuren, Knicke möglich",
  4: "Lose Seiten, Flecken oder Notizen",
};

export const offerLabel: Record<OfferKind, string> = {
  lend: "Leihen",
  swap: "Tauschen",
  gift: "Verschenken",
};

export const offerNoun: Record<OfferKind, string> = {
  lend: "Leihe",
  swap: "Tausch",
  gift: "Geschenk",
};

export const visibilityLabel = {
  all: "Alle",
  proven: "Ab Bewährt",
  circles: "Nur meine Kreise",
} as const;

export const passOnLabel = {
  never: "Nie",
  on_request: "Auf Anfrage",
  always: "Immer",
} as const;

export const trustLabel: Record<number, string> = {
  0: "Neu",
  1: "Bewährt",
  2: "Vertraut",
};

export const statusLabel: Record<LoanStatus, string> = {
  requested: "Angefragt",
  accepted: "Angenommen",
  active: "Ausgeliehen",
  return_reported: "Rückgabe gemeldet",
  returned: "Zurück, in Prüfung",
  disputed: "Fall offen",
  completed: "Abgeschlossen",
  declined: "Abgelehnt",
  withdrawn: "Zurückgezogen",
  expired: "Verfallen",
  cancelled: "Storniert",
  lost: "Verloren",
};

export const ratingReasonLabel = {
  late: "Unpünktlich",
  condition: "Zustand",
  communication: "Kommunikation",
  no_show: "Nicht erschienen",
} as const;

export const reportReasonLabel = {
  harassment: "Belästigung",
  commercial: "Verkauf oder kommerziell",
  inappropriate: "Unzulässiger Inhalt",
  fake: "Falsche Angaben",
  price_pattern: "Preisangabe im Chat",
  other: "Anderes",
} as const;

export const caseResponseLabel = {
  return_date: "Rückgabetermin nennen",
  replace_same: "Ersatz durch gleiches Exemplar",
  replace_other: "Ersatz durch ein anderes Buch nach Wahl der verleihenden Person",
  swap_offer: "Behalten und dafür ein eigenes Buch geben",
  object: "Widerspruch",
} as const;

export const languageLabel: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
  it: "Italienisch",
  es: "Spanisch",
  rm: "Rätoromanisch",
};

export const genres = [
  "Roman",
  "Krimi",
  "Sachbuch",
  "Kinderbuch",
  "Jugendbuch",
  "Lyrik",
  "Biografie",
  "Geschichte",
  "Philosophie",
  "Wissenschaft",
  "Kochen",
  "Reisen",
  "Comic",
  "Fantasy",
  "Ratgeber",
] as const;
