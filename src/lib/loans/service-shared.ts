/**
 * Vorgänge: gemeinsame Hilfen der Teilmodule (Buchungen, Besitzwechsel, Fotos, Pausen).
 * Teil von ./service.ts (dort öffentlich exportiert).
 */
import type postgres from "postgres";
import { type Tx, PG, pgCode } from "@/lib/db";
import { err } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { transition, type ActorRef, type LoanRow } from "./core";
import type { OfferKind } from "./machine";

export type TxSql = postgres.TransactionSql;
export const SYSTEM: ActorRef = { role: "system", id: null };

export async function releaseBookings(tx: Tx, loan: LoanRow) {
  await tx`delete from copy_bookings where loan_id = ${loan.id}`;
  if (loan.swap_copy_id) {
    await tx`delete from copy_bookings where copy_id = ${loan.swap_copy_id} and loan_id is null and note = ${"Tausch " + loan.id}`;
  }
}


/** Verschiebt die Buchung eines Vorgangs. false, wenn der Zeitraum leer, verkehrt oder belegt ist. */
export async function tryMoveBooking(tx: TxSql, loanId: string, start: string, end: string) {
  if (!(start < end)) return false;
  try {
    await tx.savepoint((sp) => sp`update copy_bookings set period = daterange(${start}::date, ${end}::date) where loan_id = ${loanId}`);
    return true;
  } catch (e) {
    // 23P01 belegt, 23514 Prüfregel (z. B. leerer Zeitraum), 22000 ungültiger Zeitraum
    if ([PG.EXCLUSION, PG.CHECK, "22000"].includes(pgCode(e) as string)) return false;
    throw e;
  }
}


/**
 * Besitzwechsel bei Tausch und Geschenk (5.1, 5.2). Das Exemplar erscheint im neuen Regal
 * als «nicht angeboten». Geschenke sind 30 Tage für Weitergabe gesperrt.
 */
export async function transferOwnership(tx: Tx, copyId: string, newOwner: string, kind: OfferKind, fromOwner: string) {
  // Nur übertragen, was der bisherigen Person noch gehört – sonst würde einem Dritten das Buch entzogen
  const moved = await tx<{ id: string }[]>`
    update copies set owner_id = ${newOwner}, offers = '{}', visibility = 'all', acquired_at = now(),
           transfer_locked_until = ${kind === "gift" ? tx`now() + interval '30 days'` : tx`null`}
     where id = ${copyId} and owner_id = ${fromOwner} and removed_at is null
     returning id`;
  if (!moved.length) throw err.conflict("copy_gone", "Ein Buch dieses Tauschs gehört inzwischen jemand anderem. Der Vorgang lässt sich so nicht abschliessen.");
  await tx`delete from copy_bookings where copy_id = ${copyId} and (loan_id is null or upper(period) is null)`;
  await tx`delete from circle_copies where copy_id = ${copyId}`;
  // Offene Anfragen auf dieses Exemplar beim bisherigen Besitzer verfallen
  const stale = await tx<{ id: string }[]>`select id from loans where copy_id = ${copyId} and status = 'requested' and owner_id = ${fromOwner}`;
  for (const o of stale) {
    await transition(tx as TxSql, o.id, "expire_request", SYSTEM, { set: tx`closed_at = now()`, meta: { reason: "copy_transferred" } });
  }
}


/**
 * Foto-Schlüssel aus dem Client nur annehmen, wenn sie zu eigenen, verarbeiteten Uploads
 * für genau diesen Vorgang gehören (sonst liessen sich fremde Bilder als Nachweis unterschieben).
 */
export async function assertOwnPhotos(tx: Tx, userId: string, loanId: string, keysIn: string[], purpose: "dropoff" | "condition" | "case") {
  const list = [...new Set(keysIn.filter(Boolean))];
  if (!list.length) return list;
  const prefix = purpose === "case" ? `cases/${loanId}/` : `loans/${loanId}/${purpose}/`;
  if (list.some((k) => !k.startsWith(prefix))) throw err.invalid("Diese Fotos gehören nicht zu diesem Vorgang.");
  const ok = await tx<{ key: string }[]>`
    select key from uploads where user_id = ${userId} and purpose = ${purpose} and key in ${tx(list)} and status <> 'rejected'`;
  if (ok.length !== list.length) throw err.invalid("Lade die Fotos neu hoch und versuche es nochmals.");
  return list;
}


// ---------------------------------------------------------------------------
// Frühere Rückgabe: nächste Person darf früher beginnen (4.6, 4.8)
// ---------------------------------------------------------------------------

export async function offerEarlierStart(tx: Tx, copyId: string) {
  const [next] = await tx<{ loan_id: string; borrower_id: string; start: string; title: string }[]>`
    select b.loan_id, l.borrower_id, lower(b.period)::text as start, e.title
      from copy_bookings b
      join loans l on l.id = b.loan_id and l.status = 'accepted'
      join copies c on c.id = b.copy_id
      join editions e on e.id = c.edition_id
     where b.copy_id = ${copyId} and lower(b.period) > today_ch()
     order by lower(b.period) limit 1`;
  if (!next) return;
  // Frei ab: Ende der letzten laufenden Buchung plus Puffer, sonst heute
  const [free] = await tx<{ from: string }[]>`
    select greatest(today_ch(), coalesce(max(upper(period) + buffer_days), today_ch()))::text as from
      from copy_bookings
     where copy_id = ${copyId} and upper(period) is not null and lower(period) < ${next.start}::date and loan_id is distinct from ${next.loan_id}`;
  if (free.from < next.start) {
    const mark = `earlier:${free.from}`;
    const inserted = await tx`insert into deadline_marks (loan_id, mark) values (${next.loan_id}, ${mark}) on conflict do nothing returning 1`;
    if (inserted.length) {
      await notify(tx, { userId: next.borrower_id, type: "start_earlier", loanId: next.loan_id, data: { title: next.title, day: free.from } });
    }
  }
}


/** Fall eröffnet oder Buch verloren: alle künftigen Buchungen werden pausiert, die Betroffenen informiert (4.8). */
export async function pauseFutureBookings(tx: Tx, copyId: string, exceptLoan: string) {
  const rows = await tx<{ loan_id: string; borrower_id: string; title: string }[]>`
    update copy_bookings b set paused = true
      from loans l, copies c, editions e
     where b.copy_id = ${copyId} and b.loan_id = l.id and l.id <> ${exceptLoan} and l.status = 'accepted'
       and c.id = b.copy_id and e.id = c.edition_id and not b.paused
    returning b.loan_id, l.borrower_id, e.title`;
  for (const r of rows) await notify(tx, { userId: r.borrower_id, type: "bookings_paused", loanId: r.loan_id, data: { title: r.title } });
}

export async function resumePausedBookings(tx: Tx, copyId: string) {
  await tx`update copy_bookings set paused = false where copy_id = ${copyId} and paused`;
}

export async function liftSuspensionIfClear(tx: Tx, userId: string) {
  await tx`
    update users set lending_suspended_at = null
     where id = ${userId} and lending_suspended_at is not null
       and not exists (select 1 from cases c join loans l on l.id = c.loan_id
                        where l.borrower_id = ${userId} and c.closed_at is null and c.stage >= 2)`;
}


// ---------------------------------------------------------------------------
// Übergabe-Chats schreibschützen: 7 Tage nach dem Wechsel (4.10)
// ---------------------------------------------------------------------------

export async function closeHandoverChatsFor(tx: Tx, startedLoanId: string) {
  await tx`update handover_chats set read_only_at = now() + interval '7 days'
            where next_loan_id = ${startedLoanId} and read_only_at is null`;
}

