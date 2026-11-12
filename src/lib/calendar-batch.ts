import type { Tx } from "@/lib/db";
import { addDays, parseRange, todayCH } from "@/lib/dates";
import type { LoanStatus } from "@/lib/loans/machine";
import { freeSlots, type Calendar, type CalendarBar } from "@/lib/loans/calendar";

/**
 * Verleihkalender für viele Exemplare auf einmal (Gesamtansicht des Regals).
 * Zwei Abfragen statt zwei pro Exemplar; Ergebnis wie getCalendar je Exemplar.
 */
export async function getCalendars(tx: Tx, copyIds: string[], viewerId: string | null): Promise<Map<string, Calendar>> {
  const out = new Map<string, Calendar>();
  if (copyIds.length === 0) return out;
  const today = todayCH();

  const copies = await tx<{ id: string; owner_id: string; loan_days: number; buffer_days: number; horizon_days: number; max_future_bookings: number }[]>`
    select id, owner_id, loan_days, buffer_days, horizon_days, max_future_bookings from copies where id = any(${copyIds}::uuid[])`;

  const rows = await tx<{
    id: number; copy_id: string; period: string; buffer_days: number; loan_id: string | null; status: LoanStatus | null;
    borrower_id: string | null; first_name: string | null; paused: boolean; note: string | null; pass_next: string | null; chat_id: string | null;
  }[]>`
    select b.id, b.copy_id, b.period::text as period, b.buffer_days, b.loan_id, l.status, l.borrower_id, u.first_name,
           b.paused, b.note,
           (select n.id from loans n where n.received_from_loan_id = l.id and n.status in ('accepted', 'active') limit 1) as pass_next,
           (select hc.id from handover_chats hc where hc.prev_loan_id = l.id limit 1) as chat_id
      from copy_bookings b
      left join loans l on l.id = b.loan_id
      left join users u on u.id = l.borrower_id
     where b.copy_id = any(${copyIds}::uuid[])
       and (upper(b.period) is null or upper(b.period) + b.buffer_days > ${addDays(today, -30)}::date)
     order by lower(b.period)`;

  const byCopy = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const list = byCopy.get(r.copy_id);
    if (list) list.push(r);
    else byCopy.set(r.copy_id, [r]);
  }

  for (const copy of copies) {
    const isOwner = viewerId === copy.owner_id;
    const bars: CalendarBar[] = (byCopy.get(copy.id) ?? []).map((r) => {
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
    out.set(copy.id, {
      copyId: copy.id,
      today,
      horizonEnd,
      loanDays: copy.loan_days,
      bufferDays: copy.buffer_days,
      maxFutureBookings: copy.max_future_bookings,
      futureBookings: bars.filter((b) => b.kind === "loan" && b.start > today).length,
      bars,
      free: freeSlots(bars, today, horizonEnd, copy.buffer_days),
    });
  }
  return out;
}
