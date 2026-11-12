import type { Tx } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { deadline, dueDay, fmtDay, fmtDayTime, dayToDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/locale";
import { TEXTS, quote, verb } from "./texts";

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
  | "case_response"
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
  case_response: "cases",
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
  const [row] = await tx<{ id: string; email: string; email_prefs: Record<string, boolean>; phone_e164: string | null; has_push: boolean }[]>`
    with ins as (
      insert into notifications (user_id, type, channel, loan_id, payload)
      values (${n.userId}, ${n.type}, 'app', ${n.loanId ?? null}, ${tx.json(data as never)})
      returning id, user_id
    )
    select ins.id, u.email, u.email_prefs, u.phone_e164,
           exists (select 1 from push_subscriptions p where p.user_id = ins.user_id) as has_push
      from ins join users u on u.id = ins.user_id`;
  if (!row) return;

  // Push aufs Handy, sofern ein Gerät angemeldet ist (verweist auf die App-Benachrichtigung)
  if (row.has_push) await enqueue(tx, "send_push", { notificationId: row.id });

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

/** Titel und Text einer Benachrichtigung in der Sprache der Person */
export function renderNotification(type: NotificationType, d: NotifyData, l: Locale = "de"): { title: string; body: string } {
  const table = TEXTS[l] ?? TEXTS.de;
  const fn = table[type];
  if (!fn) return { title: "Leihregal", body: d.at ? fmtDayTime(d.at, l) : "" };
  const [title, body] = fn({
    t: quote[l](d.title),
    name: d.name ?? "",
    verb: verb[l](d.kind),
    due: d.due ? deadline(dueDay(d.due), undefined, l) : "",
    day: d.day ? fmtDay(dayToDate(d.day), l) : "",
    d,
  });
  return { title, body };
}
