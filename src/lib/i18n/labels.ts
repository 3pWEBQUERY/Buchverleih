/**
 * Begriffe der Oberfläche in drei Sprachen. Deutsch stammt aus de-CH.ts (unverändert),
 * Französisch und Italienisch haben dieselbe Struktur.
 */
import type { LoanStatus, OfferKind } from "@/lib/loans/machine";
import * as de from "./de-CH";
import type { Locale } from "./locale";

type Labels = {
  conditionLabel: Record<number, string>;
  conditionHint: Record<number, string>;
  offerLabel: Record<OfferKind, string>;
  offerNoun: Record<OfferKind, string>;
  trustLabel: Record<number, string>;
  statusLabel: Record<LoanStatus, string>;
  languageLabel: Record<string, string>;
  /** Anzeige der Genres; die gespeicherten Werte bleiben deutsch */
  genreLabel: Record<string, string>;
};

const DE: Labels = {
  conditionLabel: de.conditionLabel,
  conditionHint: de.conditionHint,
  offerLabel: de.offerLabel,
  offerNoun: de.offerNoun,
  trustLabel: de.trustLabel,
  statusLabel: de.statusLabel,
  languageLabel: de.languageLabel,
  genreLabel: Object.fromEntries(de.genres.map((g) => [g, g])),
};

const FR: Labels = {
  conditionLabel: { 1: "Comme neuf", 2: "Bon", 3: "Lu", 4: "Très usé" },
  conditionHint: {
    1: "Aucune trace de lecture",
    2: "Légères traces de lecture, dos intact",
    3: "Traces de lecture nettes, plis possibles",
    4: "Pages détachées, taches ou annotations",
  },
  offerLabel: { lend: "Prêter", swap: "Échanger", gift: "Donner" },
  offerNoun: { lend: "Prêt", swap: "Échange", gift: "Don" },
  trustLabel: { 0: "Nouveau", 1: "Confirmé", 2: "De confiance" },
  statusLabel: {
    requested: "Demandé",
    accepted: "Accepté",
    active: "Prêté",
    return_reported: "Retour signalé",
    returned: "Rendu, en vérification",
    disputed: "Litige ouvert",
    completed: "Terminé",
    declined: "Refusé",
    withdrawn: "Retiré",
    expired: "Expiré",
    cancelled: "Annulé",
    lost: "Perdu",
  },
  languageLabel: { de: "Allemand", en: "Anglais", fr: "Français", it: "Italien", es: "Espagnol", rm: "Romanche" },
  genreLabel: {
    Roman: "Roman", Krimi: "Polar", Sachbuch: "Essai", Kinderbuch: "Livre pour enfants", Jugendbuch: "Livre jeunesse",
    Lyrik: "Poésie", Biografie: "Biographie", Geschichte: "Histoire", Philosophie: "Philosophie", Wissenschaft: "Sciences",
    Kochen: "Cuisine", Reisen: "Voyage", Comic: "BD", Fantasy: "Fantasy", Ratgeber: "Guide pratique",
  },
};

const IT: Labels = {
  conditionLabel: { 1: "Come nuovo", 2: "Buono", 3: "Letto", 4: "Molto usato" },
  conditionHint: {
    1: "Nessun segno di lettura",
    2: "Lievi segni di lettura, dorso intatto",
    3: "Segni di lettura evidenti, possibili pieghe",
    4: "Pagine staccate, macchie o annotazioni",
  },
  offerLabel: { lend: "Prestare", swap: "Scambiare", gift: "Regalare" },
  offerNoun: { lend: "Prestito", swap: "Scambio", gift: "Regalo" },
  trustLabel: { 0: "Nuovo", 1: "Affidabile", 2: "Di fiducia" },
  statusLabel: {
    requested: "Richiesto",
    accepted: "Accettato",
    active: "In prestito",
    return_reported: "Restituzione segnalata",
    returned: "Restituito, in verifica",
    disputed: "Caso aperto",
    completed: "Concluso",
    declined: "Rifiutato",
    withdrawn: "Ritirato",
    expired: "Scaduto",
    cancelled: "Annullato",
    lost: "Perso",
  },
  languageLabel: { de: "Tedesco", en: "Inglese", fr: "Francese", it: "Italiano", es: "Spagnolo", rm: "Romancio" },
  genreLabel: {
    Roman: "Romanzo", Krimi: "Giallo", Sachbuch: "Saggistica", Kinderbuch: "Libro per bambini", Jugendbuch: "Libro per ragazzi",
    Lyrik: "Poesia", Biografie: "Biografia", Geschichte: "Storia", Philosophie: "Filosofia", Wissenschaft: "Scienza",
    Kochen: "Cucina", Reisen: "Viaggi", Comic: "Fumetti", Fantasy: "Fantasy", Ratgeber: "Manuale pratico",
  },
};

const ALL: Record<Locale, Labels> = { de: DE, fr: FR, it: IT };

export function labels(l: Locale): Labels {
  return ALL[l] ?? DE;
}
