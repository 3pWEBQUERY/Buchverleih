/** Texte der Moderationsoberfläche */
export const caseKindLabel: Record<string, string> = {
  damage: "Schaden",
  nonreturn: "Nicht zurückgegeben",
};

export function caseStageLabel(stage: number) {
  return ["Offen", "Zweite Aufforderung (Tag 7)", "Leihsperre, Moderation prüft (Tag 14)", "Als verloren geschlossen"][stage] ?? `Stufe ${stage}`;
}

export const caseOutcomeLabel: Record<string, string> = {
  returned: "Zurückgegeben",
  replaced: "Ersatz geleistet",
  swapped: "Als Tausch abgeschlossen",
  lost: "Verloren",
  rejected: "Kein Schaden",
};

export const targetTypeLabel: Record<string, string> = {
  user: "Konto",
  message: "Nachricht",
  copy: "Exemplar",
  photo: "Foto",
  edition: "Ausgabe",
  loan: "Vorgang",
  case: "Fall",
  report: "Meldung",
  correction: "Katalogkorrektur",
  flag: "Schalter",
};

export const fieldLabel: Record<string, string> = {
  title: "Titel",
  authors: "Autorschaft",
  publisher: "Verlag",
  year: "Jahr",
  language: "Sprache",
  genre: "Genre",
};

export const flagLabel: Record<string, [label: string, hint: string]> = {
  swap: ["Tauschen", "Bücher 1:1 tauschen und verschenken."],
  pass_on: ["Direkte Weitergabe", "Buch geht vom ersten zum zweiten Leiher, mit drei Zustimmungen."],
  wishlist: ["Wunschliste und Titelalarm", "Benachrichtigung, sobald ein Titel in der Nähe frei wird."],
  map: ["Karte", "Regale als Flächen auf einer Karte. Phase 2."],
  shipping: ["Versand", "Knopf «Versand gewünscht» zählt die Nachfrage. Phase 3."],
};

export const actionLabel: Record<string, string> = {
  read_chat: "Chat eingesehen",
  case_returned: "Fall entschieden: zurückgegeben",
  case_replaced: "Fall entschieden: Ersatz",
  case_rejected: "Fall entschieden: kein Schaden",
  case_lost: "Fall entschieden: verloren",
  report_actioned: "Meldung erledigt",
  report_dismissed: "Meldung verworfen",
  ban: "Konto gesperrt",
  unban: "Konto entsperrt",
  suspend: "Leihsperre gesetzt",
  unsuspend: "Leihsperre aufgehoben",
  avatar_removed: "Profilbild entfernt",
  correction_applied: "Korrektur übernommen",
  correction_rejected: "Korrektur abgelehnt",
  flag_on: "Schalter an",
  flag_off: "Schalter aus",
};

export const kindLabel: Record<string, string> = { lend: "Leihe", swap: "Tausch", gift: "Geschenk" };

export const handoverMethodLabel: Record<string, string> = {
  scan: "QR-Code gescannt",
  code: "Sechsstelliger Code",
  report: "Einseitig gemeldet",
  dropoff: "Ablage",
  pass_on: "Direkte Weitergabe",
};
