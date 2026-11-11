/**
 * Zustandsmaschine eines Vorgangs (PRD 4, 5, 6, 10.2).
 *
 * Dies ist die einzige Stelle, die festlegt, welcher Wechsel erlaubt ist.
 * API und Worker rufen ausschliesslich die Funktionen in ./service.ts auf,
 * die ihre SQL-Bedingungen aus dieser Tabelle ableiten. Jeder Wechsel hat
 * genau einen Auslöser: eine Handlung eines Mitglieds oder eine abgelaufene Frist.
 */

export const LOAN_STATUSES = [
  "requested",
  "accepted",
  "active",
  "return_reported",
  "returned",
  "disputed",
  "completed",
  "declined",
  "withdrawn",
  "expired",
  "cancelled",
  "lost",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const OFFER_KINDS = ["lend", "swap", "gift"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export type Actor = "owner" | "borrower" | "system" | "moderator";
export const ACTORS: Actor[] = ["owner", "borrower", "system", "moderator"];

export const TERMINAL: LoanStatus[] = ["completed", "declined", "withdrawn", "expired", "cancelled", "lost"];
export const OPEN: LoanStatus[] = LOAN_STATUSES.filter((s) => !TERMINAL.includes(s));

type Rule = {
  from: LoanStatus[];
  /** Zielstatus. Eine Funktion, wenn er von der Vorgangsart abhängt. */
  to: LoanStatus | ((kind: OfferKind) => LoanStatus);
  actors: Actor[];
  kinds: OfferKind[];
  /** Kurzbeschreibung für Verlauf und Dokumentation */
  label: string;
};

const ALL: OfferKind[] = ["lend", "swap", "gift"];
const LEND: OfferKind[] = ["lend"];

export const RULES = {
  // Anfrage und Antwort (4.2)
  accept: { from: ["requested"], to: "accepted", actors: ["owner"], kinds: ALL, label: "Anfrage angenommen" },
  auto_accept: { from: ["requested"], to: "accepted", actors: ["system"], kinds: ALL, label: "Im Kreis automatisch angenommen" },
  decline: { from: ["requested"], to: "declined", actors: ["owner"], kinds: ALL, label: "Anfrage abgelehnt" },
  withdraw: { from: ["requested"], to: "withdrawn", actors: ["borrower"], kinds: ALL, label: "Anfrage zurückgezogen" },
  expire_request: { from: ["requested"], to: "expired", actors: ["system"], kinds: ALL, label: "Anfrage nach 72 Stunden verfallen" },

  // Vor der Übergabe (4.8)
  cancel: { from: ["accepted"], to: "cancelled", actors: ["owner", "borrower"], kinds: ALL, label: "Storniert" },
  expire_handover: { from: ["accepted"], to: "expired", actors: ["system"], kinds: ALL, label: "Keine Übergabe innert 7 Tagen nach Beginn" },
  report_handover: { from: ["accepted"], to: "accepted", actors: ["owner", "borrower"], kinds: ALL, label: "Übergabe gemeldet" },
  dropoff: { from: ["accepted"], to: "accepted", actors: ["owner"], kinds: ["lend", "gift"], label: "In der Ablage hinterlegt" },
  object_handover: { from: ["accepted"], to: "accepted", actors: ["owner", "borrower"], kinds: ALL, label: "Einspruch gegen Übergabemeldung" },
  swap_scan: { from: ["accepted"], to: "accepted", actors: ["owner", "borrower"], kinds: ["swap"], label: "Erster Tauschscan" },

  // Übergabe: Leihe beginnt, Tausch und Geschenk sind damit abgeschlossen (4.3, 5.1, 5.2)
  handover: {
    from: ["accepted"],
    to: (k) => (k === "lend" ? "active" : "completed"),
    actors: ["owner", "borrower"],
    kinds: ALL,
    label: "Übergeben",
  },
  confirm_handover: {
    from: ["accepted"],
    to: (k) => (k === "lend" ? "active" : "completed"),
    actors: ["owner", "borrower"],
    kinds: ALL,
    label: "Übergabe bestätigt",
  },
  handover_report_lapse: {
    from: ["accepted"],
    to: (k) => (k === "lend" ? "active" : "completed"),
    actors: ["system"],
    kinds: ALL,
    label: "Übergabe gilt nach 48 Stunden ohne Einspruch",
  },

  // Während der Leihe (4.4)
  condition_note: { from: ["active"], to: "active", actors: ["borrower"], kinds: LEND, label: "Zustandsnotiz" },
  extend: { from: ["active"], to: "active", actors: ["borrower"], kinds: LEND, label: "Verlängert" },
  request_extension: { from: ["active"], to: "active", actors: ["borrower"], kinds: LEND, label: "Verlängerung angefragt" },
  grant_extension: { from: ["active"], to: "active", actors: ["owner"], kinds: LEND, label: "Verlängerung gewährt" },
  recall: { from: ["active"], to: "active", actors: ["owner"], kinds: LEND, label: "Zurückgerufen" },
  offer_swap: { from: ["active"], to: "active", actors: ["borrower"], kinds: LEND, label: "Behalten gegen Tausch angeboten" },
  convert_to_swap: { from: ["active", "disputed"], to: "completed", actors: ["owner"], kinds: LEND, label: "Leihe als Tausch abgeschlossen" },

  // Rückgabe (4.3)
  return: { from: ["active", "disputed"], to: "returned", actors: ["owner"], kinds: LEND, label: "Zurückgegeben" },
  report_return: { from: ["active", "disputed"], to: "return_reported", actors: ["borrower"], kinds: LEND, label: "Rückgabe gemeldet" },
  confirm_return: { from: ["return_reported"], to: "returned", actors: ["owner"], kinds: LEND, label: "Rückgabe bestätigt" },
  object_return: { from: ["return_reported"], to: "active", actors: ["owner"], kinds: LEND, label: "Einspruch gegen Rückgabemeldung" },
  return_report_lapse: { from: ["return_reported"], to: "returned", actors: ["system"], kinds: LEND, label: "Rückgabe gilt nach 48 Stunden ohne Einspruch" },
  pass_on: { from: ["active"], to: "returned", actors: ["borrower"], kinds: LEND, label: "Direkt weitergegeben" },

  // Prüfung (4.2, 6.2)
  complete: { from: ["returned"], to: "completed", actors: ["owner", "system"], kinds: LEND, label: "Abgeschlossen" },
  report_damage: { from: ["returned"], to: "disputed", actors: ["owner"], kinds: LEND, label: "Schaden gemeldet" },

  // Streitfall (4.5, 6.3)
  open_case: { from: ["active"], to: "disputed", actors: ["owner"], kinds: LEND, label: "Fall eröffnet" },
  auto_open_case: { from: ["active"], to: "disputed", actors: ["system"], kinds: LEND, label: "Fall automatisch eröffnet" },
  resolve_case: { from: ["disputed"], to: "completed", actors: ["owner", "moderator"], kinds: LEND, label: "Fall gelöst" },
  mark_lost: { from: ["disputed"], to: "lost", actors: ["system", "moderator"], kinds: LEND, label: "Als verloren geschlossen" },
  clear_loss: { from: ["lost"], to: "completed", actors: ["owner", "moderator"], kinds: LEND, label: "Verlust bereinigt" },
} satisfies Record<string, Rule>;

export type Action = keyof typeof RULES;
export const ACTIONS = Object.keys(RULES) as Action[];

export function rule(action: Action): Rule {
  return RULES[action] as Rule;
}

export function targetStatus(action: Action, kind: OfferKind): LoanStatus {
  const r = rule(action);
  return typeof r.to === "function" ? r.to(kind) : r.to;
}

export type Check = { ok: true; to: LoanStatus } | { ok: false; reason: "status" | "actor" | "kind" };

/** Reine Prüfung, ohne Datenbank: Darf `actor` bei Vorgangsart `kind` im Status `from` `action` ausführen? */
export function can(action: Action, from: LoanStatus, actor: Actor, kind: OfferKind): Check {
  const r = rule(action);
  if (!r.kinds.includes(kind)) return { ok: false, reason: "kind" };
  if (!r.actors.includes(actor)) return { ok: false, reason: "actor" };
  if (!r.from.includes(from)) return { ok: false, reason: "status" };
  return { ok: true, to: targetStatus(action, kind) };
}

/** Welche Handlungen stehen einer Person in diesem Zustand offen? */
export function availableActions(from: LoanStatus, actor: Actor, kind: OfferKind): Action[] {
  return ACTIONS.filter((a) => can(a, from, actor, kind).ok);
}

export function isTerminal(s: LoanStatus) {
  return TERMINAL.includes(s);
}
