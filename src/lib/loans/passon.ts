/**
 * Direkte Weitergabe (PRD 4.9) und Übergabe-Chat (4.10).
 */
import type postgres from "postgres";
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { addDays, parseRange } from "@/lib/dates";
import { getLoan, loanInfo, logEvent, type LoanRow } from "./core";

type TxSql = postgres.TransactionSql;

/** Vorgänger-Leihe desselben Exemplars, die höchstens 7 Tage vor `loan` endet. */
async function predecessor(tx: Tx, loan: LoanRow) {
  const start = parseRange(loan.wanted)!.start;
  const [prev] = await tx<(LoanRow & { booking_end: string })[]>`
    select p.*, upper(b.period)::text as booking_end
      from copy_bookings b join loans p on p.id = b.loan_id
     where b.copy_id = ${loan.copy_id} and p.id <> ${loan.id}
       and p.status in ('accepted', 'active') and p.kind = 'lend'
       and upper(b.period) <= ${start}::date and upper(b.period) >= ${addDays(start, -7)}::date
     order by upper(b.period) desc limit 1`;
  return prev ?? null;
}

/** Länge der Weitergabekette, die bei `loanId` endet */
async function chainLength(tx: Tx, loanId: string) {
  const [r] = await tx<{ n: number }[]>`
    with recursive chain as (
      select id, received_from_loan_id from loans where id = ${loanId}
      union all
      select l.id, l.received_from_loan_id from loans l join chain c on l.id = c.received_from_loan_id
    ) select (count(*) - 1)::int as n from chain`;
  return r.n;
}

async function sharedCircleOfThree(tx: Tx, a: string, b: string, c: string) {
  const [r] = await tx<{ n: number }[]>`
    select count(*)::int as n from circle_members m1
      join circle_members m2 on m2.circle_id = m1.circle_id and m2.user_id = ${b} and m2.status = 'active'
      join circle_members m3 on m3.circle_id = m1.circle_id and m3.user_id = ${c} and m3.status = 'active'
     where m1.user_id = ${a} and m1.status = 'active'`;
  return r.n > 0;
}

/**
 * Nach Annahme einer Leihe: Folgen zwei Leihen aufeinander, entsteht der Übergabe-Chat,
 * und – wenn die Regeln es erlauben – wird die direkte Weitergabe angeboten.
 */
export async function afterAcceptConsecutive(tx: TxSql, next: LoanRow) {
  const prev = await predecessor(tx, next);
  if (!prev) return;
  const info = await loanInfo(tx, next.id);

  // Übergabe-Chat: ein Chat pro Wechsel
  const [chat] = await tx<{ id: string }[]>`
    insert into handover_chats (prev_loan_id, next_loan_id) values (${prev.id}, ${next.id})
    on conflict do nothing returning id`;
  if (chat) {
    await tx`insert into messages (handover_chat_id, sender_id, body)
             values (${chat.id}, null, ${"Zwei Leihen folgen aufeinander. Hier sprecht ihr den Wechsel ab: direkt oder über den Verleiher."})`;
    for (const uid of [next.owner_id, prev.borrower_id, next.borrower_id]) {
      await notify(tx, { userId: uid, type: "handover_chat", loanId: next.id, data: { title: info.title } });
    }
  }

  // Direkte Weitergabe nur unter den Bedingungen aus 4.9
  const [copy] = await tx<{ pass_on: "never" | "on_request" | "always"; chain_max: number }[]>`
    select pass_on, chain_max from copies where id = ${next.copy_id}`;
  if (copy.pass_on === "never") return;
  const [trust] = await tx<{ a: number; b: number }[]>`
    select (select trust_level from users where id = ${prev.borrower_id}) as a,
           (select trust_level from users where id = ${next.borrower_id}) as b`;
  const inCircle = await sharedCircleOfThree(tx, next.owner_id, prev.borrower_id, next.borrower_id);
  if (!(inCircle || (trust.a >= 1 && trust.b >= 1))) return;
  const [blocked] = await tx<{ n: number }[]>`
    select count(*)::int as n from blocks
     where blocker_id in (${next.owner_id}, ${prev.borrower_id}, ${next.borrower_id})
       and blocked_id in (${next.owner_id}, ${prev.borrower_id}, ${next.borrower_id})`;
  if (blocked.n > 0) return;
  if ((await chainLength(tx, prev.id)) >= copy.chain_max) return;
  if (prev.borrower_id === next.borrower_id) return;

  const ownerOk = copy.pass_on === "always" ? true : null;
  await tx`update loans set pass_on_candidate_id = ${prev.id}, pass_on_owner_ok = ${ownerOk},
                            pass_on_prev_ok = null, pass_on_next_ok = null
            where id = ${next.id}`;
  if (ownerOk) {
    await askBorrowers(tx, next.id, info.title, info.borrower_name);
  } else {
    await notify(tx, {
      userId: next.owner_id,
      type: "pass_on_ask",
      loanId: next.id,
      data: { title: info.title, text: `Direkt von ${await firstName(tx, prev.borrower_id)} an ${info.borrower_name} weitergeben?` },
    });
  }
}

async function firstName(tx: Tx, id: string) {
  const [u] = await tx<{ first_name: string }[]>`select first_name from users where id = ${id}`;
  return u?.first_name ?? "";
}

async function askBorrowers(tx: Tx, nextId: string, title: string, nextName: string) {
  const [l] = await tx<{ prev_borrower: string; next_borrower: string }[]>`
    select p.borrower_id as prev_borrower, n.borrower_id as next_borrower
      from loans n join loans p on p.id = n.pass_on_candidate_id where n.id = ${nextId}`;
  if (!l) return;
  await notify(tx, {
    userId: l.prev_borrower,
    type: "pass_on_ask",
    loanId: nextId,
    data: { title, text: `Gibst du das Buch direkt an ${nextName} weiter? Das spart euch zwei Treffen.` },
  });
  await notify(tx, {
    userId: l.next_borrower,
    type: "pass_on_ask",
    loanId: nextId,
    data: { title, text: "Holst du das Buch direkt bei der Person ab, die es gerade hat?" },
  });
}

/** Zustimmung oder Ablehnung einer der drei Beteiligten. */
export async function passOnConsent(user: SessionUser, nextLoanId: string, agree: boolean) {
  return sql.begin(async (tx) => {
    const next = await getLoan(tx, nextLoanId, true);
    if (!next?.pass_on_candidate_id || next.status !== "accepted") throw err.conflict("no_pass_on", "Für diesen Vorgang steht keine Weitergabe an.");
    const prev = await getLoan(tx, next.pass_on_candidate_id);
    if (!prev) throw err.stale();
    let field: "pass_on_owner_ok" | "pass_on_prev_ok" | "pass_on_next_ok";
    if (user.id === next.owner_id) field = "pass_on_owner_ok";
    else if (user.id === prev.borrower_id) field = "pass_on_prev_ok";
    else if (user.id === next.borrower_id) field = "pass_on_next_ok";
    else throw err.notFound();

    const info = await loanInfo(tx, nextLoanId);
    if (!agree) {
      if (next.received_from_loan_id) {
        await releaseFollowers(tx, next.received_from_loan_id, "consent_withdrawn");
        return { agreed: false };
      }
      await tx`update loans set pass_on_candidate_id = null, pass_on_owner_ok = null, pass_on_prev_ok = null, pass_on_next_ok = null
                where id = ${nextLoanId}`;
      await logEvent(tx, nextLoanId, user.id, "pass_on_declined", "accepted", "accepted");
      return { agreed: false };
    }

    const [row] = await tx<LoanRow[]>`update loans set ${tx(field)} = true where id = ${nextLoanId} returning *`;
    await logEvent(tx, nextLoanId, user.id, "pass_on_consent", "accepted", "accepted", { who: field });
    if (field === "pass_on_owner_ok") await askBorrowers(tx, nextLoanId, info.title, info.borrower_name);

    if (row.pass_on_owner_ok && row.pass_on_prev_ok && row.pass_on_next_ok) {
      // Drei Zustimmungen: Puffer entfällt, die Folge-Leihe verweist auf ihre Vorgängerin
      await tx`update copy_bookings set buffer_days = 0 where loan_id = ${prev.id}`;
      await tx`update loans set received_from_loan_id = ${prev.id} where id = ${nextLoanId}`;
      await tx`update handover_chats set route = 'direct' where prev_loan_id = ${prev.id} and next_loan_id = ${nextLoanId}`;
      await logEvent(tx, nextLoanId, null, "pass_on_agreed", "accepted", "accepted", { prev: prev.id });
      for (const uid of [next.owner_id, prev.borrower_id, next.borrower_id]) {
        await notify(tx, { userId: uid, type: "pass_on_agreed", loanId: nextLoanId, data: { title: info.title } });
      }
      return { agreed: true, complete: true };
    }
    return { agreed: true, complete: false };
  });
}

/**
 * Der eine Scan der direkten Weitergabe (PRD 9.4): beendet die laufende Leihe und
 * startet die Folge-Leihe im selben Moment. Beide wechseln zusammen oder gar nicht.
 */
export async function executePassOn(tx: TxSql, prevId: string, nextId: string, giverId: string, receiverId: string) {
  const rows = await tx<{ returned_loan: string | null; started_loan: string | null }[]>`
    with pair as (
      select p.id as prev_id, n.id as next_id, b.period
        from loans p
        join loans n on n.received_from_loan_id = p.id and n.copy_id = p.copy_id
        join copy_bookings b on b.loan_id = n.id
       where p.id = ${prevId} and p.borrower_id = ${giverId} and p.status = 'active'
         and n.id = ${nextId} and n.borrower_id = ${receiverId} and n.status = 'accepted'
         for update of p, n
    ), prev as (
      update loans l
         set status = 'returned', returned_at = now(), inspection_until = now() + interval '48 hours',
             late = (now() > l.due_at + interval '3 days')
        from pair where l.id = pair.prev_id
      returning l.id
    ), nxt as (
      update loans l
         set status = 'active', handed_over_at = now(), handover_method = 'pass_on',
             due_at = day_start_ch(upper(pair.period)),
             condition_note_until = now() + interval '24 hours'
        from pair where l.id = pair.next_id
      returning l.id
    ), log as (
      insert into loan_events (loan_id, actor_id, action, from_status, to_status)
      select id, ${giverId}::uuid, 'pass_on', 'active'::loan_status, 'returned'::loan_status from prev
      union all
      select id, ${receiverId}::uuid, 'handover', 'accepted'::loan_status, 'active'::loan_status from nxt
    )
    select (select id from prev) as returned_loan, (select id from nxt) as started_loan`;
  const r = rows[0];
  if (!r?.returned_loan || !r.started_loan) throw err.stale();
  await tx`update copy_bookings
              set period = daterange(lower(period), greatest(lower(period) + 1, least(upper(period), today_ch() + 1)))
            where loan_id = ${prevId}`;
  await tx`update handover_chats set read_only_at = now() + interval '7 days' where next_loan_id = ${nextId}`;
  const info = await loanInfo(tx, nextId);
  await notify(tx, { userId: info.owner_id, type: "handover_done", loanId: nextId, data: { title: info.title, due: info.due_at?.toISOString() } });
  return r;
}

/**
 * Weitergabe platzt (4.9): Die erste Person gibt normal zurück. Ihre Frist verlängert sich
 * um 3 Tage, ihr entsteht kein Nachteil.
 */
export async function onPassOnBroken(tx: TxSql, next: LoanRow) {
  const prevId = next.received_from_loan_id;
  if (!prevId) return;
  await tx`update loans set received_from_loan_id = null where id = ${next.id}`;
  await tx`update copy_bookings b set buffer_days = c.buffer_days from copies c where b.loan_id = ${prevId} and c.id = b.copy_id`;
  try {
    await tx.savepoint(async (sp) => {
      await sp`update copy_bookings set period = daterange(lower(period), upper(period) + 3) where loan_id = ${prevId}`;
      await sp`update loans set due_at = due_at + interval '3 days', wanted = daterange(lower(wanted), upper(wanted) + 3)
                where id = ${prevId} and status = 'active'`;
    });
  } catch {
    // Kalender danach belegt: Frist bleibt, die Person wird im Chat informiert
  }
  await logEvent(tx, prevId, null, "pass_on_broken", "active", "active", { extendedDays: 3 });
  await tx`update handover_chats set route = 'via_owner' where prev_loan_id = ${prevId} and next_loan_id = ${next.id}`;
}

/**
 * Die Vorgänger-Leihe endet ohne direkte Weitergabe (normal zurückgegeben, verfallen, storniert,
 * Zustimmung zurückgezogen): Die Folge-Leihe geht wieder über die verleihende Person,
 * bekommt eine neue Übergabefrist und hängt nicht mehr.
 */
export async function releaseFollowers(tx: TxSql, prevId: string, reason: string) {
  const freed = await tx<{ id: string }[]>`
    update loans set received_from_loan_id = null, pass_on_candidate_id = null,
           pass_on_owner_ok = null, pass_on_prev_ok = null, pass_on_next_ok = null,
           handover_by = greatest(coalesce(handover_by, now()), day_start_ch(today_ch() + 7))
     where (received_from_loan_id = ${prevId} or pass_on_candidate_id = ${prevId}) and status = 'accepted'
     returning id`;
  for (const n of freed) {
    await tx`update copy_bookings b set buffer_days = c.buffer_days from copies c where b.loan_id = ${prevId} and c.id = b.copy_id`;
    await tx`update handover_chats set route = 'via_owner' where prev_loan_id = ${prevId} and next_loan_id = ${n.id}`;
    await logEvent(tx, n.id, null, "pass_on_broken", "accepted", "accepted", { reason });
  }
  return freed.length;
}
