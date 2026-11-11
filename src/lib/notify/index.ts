import type { Tx } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { deadline, dueDay, fmtDay, fmtDayTime, dayToDate } from "@/lib/dates";

/**
 * Benachrichtigungen (PRD 7.6). In der Web-App immer, per E-Mail für Anfragen,
 * Annahmen, Fristen und Fälle – pro Typ abschaltbar, ausser Fälle.
 * Der Text entsteht erst beim Anzeigen aus Typ und Daten, damit er übersetzbar bleibt.
 */

export type NotificationType =
  | "request_new"
  | "request_accepted"
  | "request_declined"
  | "request_expired"
  | "request_auto_accepted"
  | "cancelled"
  | "handover_reported"
  | "handover_done"
  | "handover_expired"
  | "due_soon"
  | "due_tomorrow"
  | "overdue"
  | "overdue_late"
  | "overdue_case_possible"
  | "extended"
  | "extension_requested"
  | "recalled"
  | "return_reported"
  | "returned"
  | "completed"
  | "damage_reported"
  | "case_opened"
  | "case_reminder"
  | "case_suspended"
  | "case_lost"
  | "case_resolved"
  | "pass_on_ask"
  | "pass_on_agreed"
  | "handover_chat"
  | "start_earlier"
  | "bookings_paused"
  | "someone_waiting"
  | "swap_offer"
  | "title_alarm"
  | "swap_match"
  | "message"
  | "invite_own_books"
  | "circle_join_request";

/** Kategorien für die E-Mail-Einstellungen */
export const EMAIL_CATEGORY: Partial<Record<NotificationType, "requests" | "accepts" | "deadlines" | "cases" | "matches">> = {
  request_new: "requests",
  request_accepted: "accepts",
  request_declined: "accepts",
  request_expired: "requests",
  request_auto_accepted: "accepts",
  cancelled: "accepts",
  handover_reported: "deadlines",
  handover_expired: "deadlines",
  due_soon: "deadlines",
  due_tomorrow: "deadlines",
  overdue: "deadlines",
  overdue_late: "deadlines",
  overdue_case_possible: "deadlines",
  recalled: "deadlines",
  return_reported: "deadlines",
  extension_requested: "requests",
  damage_reported: "cases",
  case_opened: "cases",
  case_reminder: "cases",
  case_suspended: "cases",
  case_lost: "cases",
  case_resolved: "cases",
  pass_on_ask: "requests",
  bookings_paused: "cases",
  someone_waiting: "deadlines",
  swap_offer: "requests",
  title_alarm: "matches",
  swap_match: "matches",
  start_earlier: "accepts",
};

export const EMAIL_CATEGORIES = {
  requests: "Neue Anfragen und Fragen an dich",
  accepts: "Antworten auf deine Anfragen",
  deadlines: "Fristen und Erinnerungen",
  matches: "Titelalarm und Tauschtreffer",
  cases: "Fälle (immer aktiv)",
} as const;

export type NotifyData = {
  title?: string;        // Buchtitel
  name?: string;         // Vorname der anderen Person
  kind?: "lend" | "swap" | "gift";
  due?: string;          // ISO-Zeitpunkt der Fälligkeit
  day?: string;          // YYYY-MM-DD
  at?: string;           // ISO-Zeitpunkt
  text?: string;
  href?: string;
  count?: number;
};

export async function notify(
  tx: Tx,
  n: { userId: string; type: NotificationType; loanId?: string | null; data?: NotifyData; sms?: boolean },
) {
  const data = n.data ?? {};
  const [row] = await tx<{ id: string; email: string; email_prefs: Record<string, boolean>; phone_e164: string | null }[]>`
    with ins as (
      insert into notifications (user_id, type, channel, loan_id, payload)
      values (${n.userId}, ${n.type}, 'app', ${n.loanId ?? null}, ${tx.json(data as never)})
      returning id, user_id
    )
    select ins.id, u.email, u.email_prefs, u.phone_e164 from ins join users u on u.id = ins.user_id`;
  if (!row) return;

  const cat = EMAIL_CATEGORY[n.type];
  if (cat && (cat === "cases" || row.email_prefs?.[cat] !== false)) {
    const [mail] = await tx<{ id: string }[]>`
      insert into notifications (user_id, type, channel, loan_id, payload)
      values (${n.userId}, ${n.type}, 'email', ${n.loanId ?? null}, ${tx.json(data as never)})
      returning id`;
    await enqueue(tx, "send_email", { notificationId: mail.id });
  }
  if (n.sms && row.phone_e164) {
    const [sms] = await tx<{ id: string }[]>`
      insert into notifications (user_id, type, channel, loan_id, payload)
      values (${n.userId}, ${n.type}, 'sms', ${n.loanId ?? null}, ${tx.json(data as never)})
      returning id`;
    await enqueue(tx, "send_sms", { notificationId: sms.id });
  }
}

const q = (t?: string) => (t ? `«${t}»` : "das Buch");
const noun = (k?: string) => (k === "swap" ? "tauschen" : k === "gift" ? "geschenkt bekommen" : "leihen");

/** Titel und Text einer Benachrichtigung */
export function renderNotification(type: NotificationType, d: NotifyData): { title: string; body: string } {
  const t = q(d.title);
  const due = d.due ? deadline(dueDay(d.due)) : "";
  switch (type) {
    case "request_new":
      return { title: `${d.name} möchte ${t} ${noun(d.kind)}`, body: "Du hast 72 Stunden Zeit für eine Antwort. Danach verfällt die Anfrage." };
    case "request_accepted":
      return { title: `${d.name} hat angenommen`, body: `${t}: Übergabeort und Termin stehen im Vorgang.` };
    case "request_auto_accepted":
      return { title: `Im Kreis angenommen`, body: `${t} ist für dich reserviert. Sprich die Übergabe im Vorgang ab.` };
    case "request_declined":
      return { title: `Anfrage für ${t} abgelehnt`, body: "Es gibt vielleicht ein anderes Exemplar in deiner Nähe." };
    case "request_expired":
      return { title: `Anfrage für ${t} verfallen`, body: "Innert 72 Stunden kam keine Antwort. Der Zeitraum ist wieder frei." };
    case "cancelled":
      return { title: `${t}: Vorgang storniert`, body: `${d.name ?? "Die andere Seite"} hat storniert. Der Zeitraum ist wieder frei.` };
    case "handover_reported":
      return { title: `Bitte bestätige die Übergabe von ${t}`, body: "Ohne Einspruch gilt die Meldung nach 48 Stunden." };
    case "handover_done":
      return { title: `${t} ist übergeben`, body: d.due ? due : "Der Vorgang ist abgeschlossen." };
    case "handover_expired":
      return { title: `${t}: keine Übergabe`, body: "7 Tage nach dem geplanten Beginn gab es keine Übergabe. Der Vorgang ist verfallen." };
    case "due_soon":
      return { title: `${t} ist bald fällig`, body: `${due}. Verlängern oder Rückgabe planen geht im Vorgang.` };
    case "due_tomorrow":
      return { title: `${t} ist morgen fällig`, body: "Plane die Rückgabe im Vorgang." };
    case "overdue":
      return { title: `${t} ist überfällig`, body: "Schlag im Chat einen Termin für die Rückgabe vor." };
    case "overdue_late":
      return { title: `${t}: 3 Tage überfällig`, body: "Die Kulanz ist vorbei, die Leihe zählt als unpünktlich. Bitte gib das Buch so bald wie möglich zurück." };
    case "overdue_case_possible":
      return { title: `${t}: 7 Tage überfällig`, body: "Neue Anfragen sind erst nach der Rückgabe wieder möglich." };
    case "extended":
      return { title: `${t} verlängert`, body: due };
    case "extension_requested":
      return { title: `${d.name} möchte ${t} länger behalten`, body: "Entscheide im Vorgang." };
    case "recalled":
      return { title: `${d.name} ruft ${t} zurück`, body: `Bitte gib das Buch innert 7 Tagen zurück. ${due}` };
    case "return_reported":
      return { title: `Hast du ${t} zurückbekommen?`, body: "Bestätige die Rückgabe. Ohne Einspruch gilt sie nach 48 Stunden." };
    case "returned":
      return { title: `Rückgabe von ${t} bestätigt`, body: "Danke. Die Leihe wird nach der Prüfung abgeschlossen." };
    case "completed":
      return { title: `${t}: abgeschlossen`, body: "Wie war es? Eine Antwort reicht: «Gerne wieder» oder «Es gab Probleme»." };
    case "damage_reported":
      return { title: `Schaden an ${t} gemeldet`, body: "Wähle im Fall eine von drei Antworten." };
    case "case_opened":
      return { title: `Fall zu ${t} eröffnet`, body: "Nenne einen Rückgabetermin, biete Ersatz an oder schlage einen Tausch vor." };
    case "case_reminder":
      return { title: `Zweite Aufforderung: ${t}`, body: "Ohne Reaktion wird dein Konto in 7 Tagen für Leihen und Tauschen gesperrt." };
    case "case_suspended":
      return { title: "Leihen und Tauschen gesperrt", body: `Der Fall zu ${t} ist weiter offen. Die Moderation prüft ihn.` };
    case "case_lost":
      return { title: `${t} gilt als verloren`, body: "Eine spätere Rückgabe oder ein Ersatz bereinigt den Eintrag." };
    case "case_resolved":
      return { title: `Fall zu ${t} gelöst`, body: d.text ?? "Der Vorgang ist abgeschlossen." };
    case "pass_on_ask":
      return { title: `Direkt weitergeben: ${t}`, body: d.text ?? "Stimmst du zu, dass das Buch direkt weitergegeben wird?" };
    case "pass_on_agreed":
      return { title: `${t} geht direkt weiter`, body: "Alle drei haben zugestimmt. Sprecht Ort und Zeit im Übergabe-Chat ab." };
    case "handover_chat":
      return { title: `Übergabe-Chat zu ${t}`, body: "Zwei Leihen folgen aufeinander. Sprecht den Wechsel ab." };
    case "start_earlier":
      return { title: `${t} ist früher zurück`, body: d.day ? `Du kannst ab ${fmtDay(dayToDate(d.day))} beginnen.` : "Du kannst früher beginnen." };
    case "bookings_paused":
      return { title: `Buchung für ${t} pausiert`, body: "Zum Exemplar ist ein Fall offen. Du kannst ohne Nachteil stornieren." };
    case "someone_waiting":
      return { title: `${d.name} wartet auf ${t}`, body: d.day ? `Ab ${fmtDay(dayToDate(d.day))}. Bitte gib das Buch zurück.` : "Bitte gib das Buch zurück." };
    case "swap_offer":
      return { title: `${d.name} möchte ${t} behalten`, body: "und bietet dir dafür ein eigenes Buch an." };
    case "title_alarm":
      return { title: `${t} ist verfügbar`, body: d.text ?? "Ein Exemplar in deinem Umkreis ist frei." };
    case "swap_match":
      return { title: "Tauschtreffer", body: `${d.name} hat ${t} von deiner Wunschliste, und du hast eines von ${d.name}s.` };
    case "message":
      return { title: `${d.name}: ${t}`, body: d.text ?? "Neue Nachricht" };
    case "invite_own_books":
      return { title: "Dein Regal ist noch leer", body: "Wer leiht, verleiht oft auch. Ein Buch einstellen dauert unter 20 Sekunden." };
    case "circle_join_request":
      return { title: `${d.name} möchte beitreten`, body: d.text ?? "Gib die Anfrage im Kreis frei." };
    default:
      return { title: "Leihregal", body: d.at ? fmtDayTime(d.at) : "" };
  }
}
