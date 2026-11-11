import type { Tx } from "@/lib/db";
import { addDays, diffDays, parseRange, todayCH } from "@/lib/dates";
import type { LoanStatus } from "./machine";

/**
 * Verleihkalender (PRD 4.8): eine Zeitachse pro Exemplar, jede Leihe ein Balken.
 * Der Verleiher sieht Vorname, Status und Übergabeort; alle anderen nur frei und belegt.
 */
export type CalendarBar = {
  id: number;
  start: string;
  end: string | null;          // exklusiv; null = ohne Ende (Tausch, Geschenk)
  bufferDays: number;
  kind: "loan" | "block";
  status: LoanStatus | null;
  loanId: string | null;
  name: string | null;         // nur für den Verleiher
  mine: boolean;               // eigene Leihe der betrachtenden Person
  paused: boolean;
  note: string | null;
  passOn: boolean;             // direkte Weitergabe zur nächsten Leihe
  handoverChatId: string | null;
};

export type FreeSlot = { start: string; end: string; days: number };

export type Calendar = {
  copyId: string;
  today: string;
  horizonEnd: string;
  loanDays: number;
  bufferDays: number;
  maxFutureBookings: number;
  futureBookings: number;
  bars: CalendarBar[];
  free: FreeSlot[];
};

export async function getCalendar(tx: Tx, copyId: string, viewerId: string | null, circleLoanDays?: number | null): Promise<Calendar | null> {
  const [copy] = await tx<{ owner_id: string; loan_days: number; buffer_days: number; horizon_days: number; max_future_bookings: number }[]>`
    select owner_id, loan_days, buffer_days, horizon_days, max_future_bookings from copies where id = ${copyId}`;
  if (!copy) return null;
  const isOwner = viewerId === copy.owner_id;
  const today = todayCH();

  const rows = await tx<{
    id: number;
    period: string;
    buffer_days: number;
    loan_id: string | null;
    status: LoanStatus | null;
    borrower_id: string | null;
    first_name: string | null;
    paused: boolean;
    note: string | null;
    pass_next: string | null;
    chat_id: string | null;
  }[]>`
    select b.id, b.period::text as period, b.buffer_days, b.loan_id, l.status, l.borrower_id, u.first_name,
           b.paused, b.note,
           (select n.id from loans n where n.received_from_loan_id = l.id and n.status in ('accepted', 'active') limit 1) as pass_next,
           (select hc.id from handover_chats hc where hc.prev_loan_id = l.id limit 1) as chat_id
      from copy_bookings b
      left join loans l on l.id = b.loan_id
      left join users u on u.id = l.borrower_id
     where b.copy_id = ${copyId}
       and (upper(b.period) is null or upper(b.period) + b.buffer_days > ${addDays(today, -30)}::date)
     order by lower(b.period)`;

  const bars: CalendarBar[] = rows.map((r) => {
    const p = parseRange(r.period)!;
    const mine = viewerId != null && r.borrower_id === viewerId;
    return {
      id: r.id,
      start: p.start,
      end: p.end,
      bufferDays: r.buffer_days,
      kind: r.loan_id ? "loan" : "block",
      status: isOwner || mine ? r.status : null,
      loanId: isOwner || mine ? r.loan_id : null,
      name: isOwner ? r.first_name : null,
      mine,
      paused: r.paused,
      note: isOwner ? r.note : null,
      passOn: Boolean(r.pass_next),
      handoverChatId: isOwner || mine ? r.chat_id : null,
    };
  });

  const horizonEnd = addDays(today, copy.horizon_days + 1);
  const loanDays = circleLoanDays ?? copy.loan_days;
  const free = freeSlots(bars, today, horizonEnd, copy.buffer_days);
  const futureBookings = bars.filter((b) => b.kind === "loan" && b.start > today).length;

  return {
    copyId,
    today,
    horizonEnd,
    loanDays,
    bufferDays: copy.buffer_days,
    maxFutureBookings: copy.max_future_bookings,
    futureBookings,
    bars,
    free,
  };
}

/**
 * Freie Zeiträume zwischen den Balken. Ein neuer Zeitraum braucht vor der nächsten
 * Buchung den eigenen Puffer, nach einer bestehenden deren Puffer.
 * Startet ein freier Zeitraum, darf er bis zum Horizont gehen (Beginn ≤ Horizont).
 */
export function freeSlots(
  bars: Pick<CalendarBar, "start" | "end" | "bufferDays">[],
  today: string,
  horizonEnd: string,
  ownBuffer: number,
): FreeSlot[] {
  const sorted = [...bars].sort((a, b) => a.start.localeCompare(b.start));
  const out: FreeSlot[] = [];
  let cursor = today;
  for (const b of sorted) {
    const gapEnd = addDays(b.start, -ownBuffer); // exklusiv
    if (gapEnd > cursor && cursor < horizonEnd) out.push({ start: cursor, end: gapEnd, days: diffDays(cursor, gapEnd) });
    if (b.end === null) return out;
    const next = addDays(b.end, b.bufferDays);
    if (next > cursor) cursor = next;
  }
  if (cursor < horizonEnd) {
    // nach der letzten Buchung: offen bis Horizont plus maximale Leihdauer
    const end = addDays(horizonEnd, 56);
    out.push({ start: cursor, end, days: diffDays(cursor, end) });
  }
  return out.filter((s) => s.days >= 1);
}

/** Passt ein gewünschter Zeitraum in einen freien Abschnitt? */
export function fitsFree(free: FreeSlot[], start: string, end: string) {
  return free.some((s) => s.start <= start && end <= s.end);
}
