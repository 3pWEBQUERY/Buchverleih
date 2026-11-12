/**
 * Ein nächster Schritt (PRD 8.3, Punkt 1): Jede Vorgangsseite hat genau einen
 * hervorgehobenen Knopf. Diese Funktion bestimmt ihn – und wer am Zug ist.
 * Es gibt keinen Zustand, in dem unklar ist, wer als Nächstes handelt.
 */
import type { LoanStatus, OfferKind } from "./machine";
import type { Locale } from "@/lib/i18n/locale";

/** Beschriftungen und Wartetexte auf Französisch und Italienisch (Deutsch steht unten im Code) */
const TR: Record<Exclude<Locale, "de">, Record<string, string>> = {
  fr: {
    "Anfrage beantworten": "Répondre à la demande",
    "Wartet auf Antwort": "En attente de réponse",
    "Weitergabe beantworten": "Répondre à la transmission",
    "Übergabe bestätigen": "Confirmer la remise",
    "Wartet auf Bestätigung der Übergabe": "En attente de confirmation de la remise",
    "Code der anderen Seite scannen": "Scanner le code de l’autre partie",
    "Tauschcode zeigen": "Montrer le code d’échange",
    "Geht direkt weiter": "Transmis directement",
    "Code scannen": "Scanner le code",
    "Übergabecode zeigen": "Montrer le code de remise",
    "Tauschangebot ansehen": "Voir l’offre d’échange",
    "Verlängerung gewähren": "Accorder la prolongation",
    "Rückgabe scannen": "Scanner le retour",
    "Ausgeliehen": "Prêté",
    "Zustand festhalten": "Noter l’état",
    "Rückgabecode zeigen": "Montrer le code de retour",
    "Rückgabe bestätigen": "Confirmer le retour",
    "Wartet auf Bestätigung der Rückgabe": "En attente de confirmation du retour",
    "Alles in Ordnung": "Tout est en ordre",
    "Zurück, in Prüfung": "Rendu, en vérification",
    "Im Fall antworten": "Répondre dans le litige",
    "Ersatz bestätigen": "Confirmer le remplacement",
    "Fall offen": "Litige ouvert",
    "Die Moderation entscheidet": "La modération décide",
    "Kurz bewerten": "Évaluer rapidement",
    "Buch ist doch zurück": "Le livre est revenu",
  },
  it: {
    "Anfrage beantworten": "Rispondi alla richiesta",
    "Wartet auf Antwort": "In attesa di risposta",
    "Weitergabe beantworten": "Rispondi al passaggio",
    "Übergabe bestätigen": "Conferma la consegna",
    "Wartet auf Bestätigung der Übergabe": "In attesa di conferma della consegna",
    "Code der anderen Seite scannen": "Scansiona il codice dell’altra parte",
    "Tauschcode zeigen": "Mostra il codice di scambio",
    "Geht direkt weiter": "Passa direttamente",
    "Code scannen": "Scansiona codice",
    "Übergabecode zeigen": "Mostra il codice di consegna",
    "Tauschangebot ansehen": "Vedi l’offerta di scambio",
    "Verlängerung gewähren": "Concedi la proroga",
    "Rückgabe scannen": "Scansiona la restituzione",
    "Ausgeliehen": "In prestito",
    "Zustand festhalten": "Annota lo stato",
    "Rückgabecode zeigen": "Mostra il codice di restituzione",
    "Rückgabe bestätigen": "Conferma la restituzione",
    "Wartet auf Bestätigung der Rückgabe": "In attesa di conferma della restituzione",
    "Alles in Ordnung": "Tutto in ordine",
    "Zurück, in Prüfung": "Restituito, in verifica",
    "Im Fall antworten": "Rispondi nel caso",
    "Ersatz bestätigen": "Conferma la sostituzione",
    "Fall offen": "Caso aperto",
    "Die Moderation entscheidet": "Decide la moderazione",
    "Kurz bewerten": "Valuta in breve",
    "Buch ist doch zurück": "Il libro è tornato",
  },
};

export type StepKey =
  | "respond"
  | "show_code"
  | "scan_code"
  | "confirm_handover"
  | "pass_on_consent"
  | "return_code"
  | "scan_return"
  | "confirm_return"
  | "inspect"
  | "case_respond"
  | "case_resolve"
  | "grant_extension"
  | "accept_swap_offer"
  | "rate"
  | "clear_loss"
  | "condition_note";

export type NextStep = { key: StepKey; label: string } | null;
export type Turn = "me" | "other" | "system" | "done";

export type NextInput = {
  kind: OfferKind;
  status: LoanStatus;
  role: "owner" | "borrower";
  me: string;
  handover_reported_by: string | null;
  received_from_loan_id: string | null;
  swap_scan_owner_at: Date | null;
  swap_scan_borrower_at: Date | null;
  extension_requested_at: Date | null;
  swap_offer_copy_id: string | null;
  condition_note_until: Date | null;
  condition_note: string | null;
  rating_closes_at: Date | null;
  rated_by_me: boolean;
  case_response: string | null;
  case_kind: string | null;
  pass_on_pending_mine: boolean;
};

export function nextStep(input: NextInput, loc: Locale = "de"): { step: NextStep; turn: Turn; waitingText: string | null } {
  const r = nextStepDe(input);
  if (loc === "de") return r;
  const t = (x: string) => TR[loc][x] ?? x;
  return { ...r, step: r.step && { ...r.step, label: t(r.step.label) }, waitingText: r.waitingText && t(r.waitingText) };
}

function nextStepDe(l: NextInput): { step: NextStep; turn: Turn; waitingText: string | null } {
  const owner = l.role === "owner";
  switch (l.status) {
    case "requested":
      return owner
        ? { step: { key: "respond", label: "Anfrage beantworten" }, turn: "me", waitingText: null }
        : { step: null, turn: "other", waitingText: "Wartet auf Antwort" };
    case "accepted": {
      if (l.pass_on_pending_mine) return { step: { key: "pass_on_consent", label: "Weitergabe beantworten" }, turn: "me", waitingText: null };
      if (l.handover_reported_by && l.handover_reported_by !== l.me)
        return { step: { key: "confirm_handover", label: "Übergabe bestätigen" }, turn: "me", waitingText: null };
      if (l.handover_reported_by === l.me) return { step: null, turn: "other", waitingText: "Wartet auf Bestätigung der Übergabe" };
      if (l.kind === "swap") {
        const mineScanned = owner ? l.swap_scan_owner_at : l.swap_scan_borrower_at;
        return mineScanned
          ? { step: { key: "scan_code", label: "Code der anderen Seite scannen" }, turn: "me", waitingText: null }
          : { step: { key: "show_code", label: "Tauschcode zeigen" }, turn: "me", waitingText: null };
      }
      if (l.received_from_loan_id)
        return owner
          ? { step: null, turn: "other", waitingText: "Geht direkt weiter" }
          : { step: { key: "scan_code", label: "Code scannen" }, turn: "me", waitingText: null };
      return owner
        ? { step: { key: "show_code", label: "Übergabecode zeigen" }, turn: "me", waitingText: null }
        : { step: { key: "scan_code", label: "Code scannen" }, turn: "me", waitingText: null };
    }
    case "active":
      if (owner) {
        if (l.swap_offer_copy_id) return { step: { key: "accept_swap_offer", label: "Tauschangebot ansehen" }, turn: "me", waitingText: null };
        if (l.extension_requested_at) return { step: { key: "grant_extension", label: "Verlängerung gewähren" }, turn: "me", waitingText: null };
        return { step: { key: "scan_return", label: "Rückgabe scannen" }, turn: "other", waitingText: "Ausgeliehen" };
      }
      if (l.condition_note_until && l.condition_note_until > new Date() && !l.condition_note)
        return { step: { key: "condition_note", label: "Zustand festhalten" }, turn: "me", waitingText: null };
      return { step: { key: "return_code", label: "Rückgabecode zeigen" }, turn: "me", waitingText: null };
    case "return_reported":
      return owner
        ? { step: { key: "confirm_return", label: "Rückgabe bestätigen" }, turn: "me", waitingText: null }
        : { step: null, turn: "other", waitingText: "Wartet auf Bestätigung der Rückgabe" };
    case "returned":
      return owner
        ? { step: { key: "inspect", label: "Alles in Ordnung" }, turn: "me", waitingText: null }
        : { step: null, turn: "other", waitingText: "Zurück, in Prüfung" };
    case "disputed":
      if (!owner && !l.case_response) return { step: { key: "case_respond", label: "Im Fall antworten" }, turn: "me", waitingText: null };
      if (owner && l.swap_offer_copy_id) return { step: { key: "accept_swap_offer", label: "Tauschangebot ansehen" }, turn: "me", waitingText: null };
      if (owner && l.case_response && l.case_response !== "object" && l.case_response !== "return_date")
        return { step: { key: "case_resolve", label: "Ersatz bestätigen" }, turn: "me", waitingText: null };
      if (!owner && l.case_kind === "nonreturn") return { step: { key: "return_code", label: "Rückgabecode zeigen" }, turn: "me", waitingText: null };
      if (owner && l.case_kind === "nonreturn") return { step: { key: "scan_return", label: "Rückgabe scannen" }, turn: "other", waitingText: "Fall offen" };
      return { step: null, turn: l.case_response === "object" ? "system" : "other", waitingText: l.case_response === "object" ? "Die Moderation entscheidet" : "Fall offen" };
    case "completed":
      if (l.rating_closes_at && l.rating_closes_at > new Date() && !l.rated_by_me)
        return { step: { key: "rate", label: "Kurz bewerten" }, turn: "me", waitingText: null };
      return { step: null, turn: "done", waitingText: null };
    case "lost":
      return owner
        ? { step: { key: "clear_loss", label: "Buch ist doch zurück" }, turn: "done", waitingText: null }
        : { step: null, turn: "done", waitingText: null };
    default:
      return { step: null, turn: "done", waitingText: null };
  }
}
