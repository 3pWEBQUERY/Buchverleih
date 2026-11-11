import type postgres from "postgres";
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import { rule, type Action, type Actor, type LoanStatus, type OfferKind } from "./machine";

export type LoanRow = {
  id: string;
  kind: OfferKind;
  status: LoanStatus;
  copy_id: string;
  owner_id: string;
  borrower_id: string;
  wanted: string;
  circle_id: string | null;
  message: string | null;
  received_from_loan_id: string | null;
  pickup_spot_id: string | null;
  swap_offered_copy_ids: string[];
  swap_copy_id: string | null;
  swap_scan_owner_at: Date | null;
  swap_scan_borrower_at: Date | null;
  requested_at: Date;
  respond_by: Date;
  accepted_at: Date | null;
  handover_by: Date | null;
  handover_reported_at: Date | null;
  handover_reported_by: string | null;
  handover_method: string | null;
  dropoff_photo_key: string | null;
  handed_over_at: Date | null;
  condition_note_until: Date | null;
  condition_note: string | null;
  condition_photo_keys: string[];
  due_at: Date | null;
  extensions_used: number;
  extension_requested_at: Date | null;
  recalled_at: Date | null;
  return_reported_at: Date | null;
  return_reported_by: string | null;
  returned_at: Date | null;
  inspection_until: Date | null;
  closed_at: Date | null;
  cancelled_by: string | null;
  cancelled_late: boolean;
  late: boolean;
  pass_on_owner_ok: boolean | null;
  pass_on_prev_ok: boolean | null;
  pass_on_next_ok: boolean | null;
  pass_on_candidate_id: string | null;
  swap_offer_copy_id: string | null;
  rating_closes_at: Date | null;
};

export type ActorRef = { role: Actor; id: string | null };

export function roleOf(loan: Pick<LoanRow, "owner_id" | "borrower_id">, userId: string): "owner" | "borrower" | null {
  if (loan.owner_id === userId) return "owner";
  if (loan.borrower_id === userId) return "borrower";
  return null;
}

export async function getLoan(tx: Tx, id: string, lock = false): Promise<LoanRow | null> {
  const rows = lock
    ? await tx<LoanRow[]>`select * from loans where id = ${id} for update`
    : await tx<LoanRow[]>`select * from loans where id = ${id}`;
  return rows[0] ?? null;
}

/** Lädt einen Vorgang und prüft, dass die Person beteiligt ist. */
export async function loanFor(tx: Tx, id: string, userId: string) {
  const loan = await getLoan(tx, id);
  if (!loan) throw err.notFound("Diesen Vorgang gibt es nicht.");
  const role = roleOf(loan, userId);
  if (!role) throw err.notFound("Diesen Vorgang gibt es nicht.");
  return { loan, role };
}

type Fragment = postgres.PendingQuery<postgres.Row[]>;

/**
 * Führt einen Wechsel als eine bedingte Anweisung aus (PRD 9.3): Ausgangsstatus,
 * Art und Berechtigung werden in derselben Anweisung geprüft, die den Wechsel ausführt.
 * Zwei gleichzeitige Klicks können so nicht beide gewinnen.
 */
export async function transition(
  tx: Tx,
  loanId: string,
  action: Action,
  actor: ActorRef,
  opts: { set?: Fragment; where?: Fragment; meta?: Record<string, unknown> } = {},
): Promise<LoanRow & { prev_status: LoanStatus }> {
  const r = rule(action);
  if (!r.actors.includes(actor.role)) throw err.forbidden();

  const toExpr =
    typeof r.to === "function"
      ? tx`(case when l.kind = 'lend' then ${r.to("lend")} else ${r.to("gift")} end)::loan_status`
      : tx`${r.to}::loan_status`;
  const actorCond =
    actor.role === "owner"
      ? tx`and l.owner_id = ${actor.id}`
      : actor.role === "borrower"
        ? tx`and l.borrower_id = ${actor.id}`
        : tx``;

  const rows = await tx<(LoanRow & { prev_status: LoanStatus })[]>`
    with prev as (select id, status from loans where id = ${loanId} for update)
    update loans l
       set status = ${toExpr} ${opts.set ? tx`, ${opts.set}` : tx``}
      from prev
     where l.id = prev.id
       and l.status in ${tx(r.from)}
       and l.kind in ${tx(r.kinds)}
       ${actorCond}
       ${opts.where ? tx`and ${opts.where}` : tx``}
    returning l.*, prev.status as prev_status`;

  const row = rows[0];
  if (!row) {
    const loan = await getLoan(tx, loanId);
    if (!loan) throw err.notFound("Diesen Vorgang gibt es nicht.");
    if (actor.role === "owner" && loan.owner_id !== actor.id) throw err.notFound("Diesen Vorgang gibt es nicht.");
    if (actor.role === "borrower" && loan.borrower_id !== actor.id) throw err.notFound("Diesen Vorgang gibt es nicht.");
    throw err.stale();
  }
  await logEvent(tx, row.id, actor.id, action, row.prev_status, row.status, opts.meta);
  return row;
}

export async function logEvent(
  tx: Tx,
  loanId: string,
  actorId: string | null,
  action: string,
  from: LoanStatus | null,
  to: LoanStatus,
  meta?: Record<string, unknown>,
) {
  await tx`insert into loan_events (loan_id, actor_id, action, from_status, to_status, meta)
           values (${loanId}, ${actorId}, ${action}, ${from}, ${to}, ${meta ? tx.json(meta as never) : null})`;
}

export type LoanInfo = {
  id: string;
  kind: OfferKind;
  status: LoanStatus;
  title: string;
  owner_id: string;
  borrower_id: string;
  owner_name: string;
  borrower_name: string;
  copy_id: string;
  due_at: Date | null;
  wanted: string;
};

/** Titel und Vornamen für Benachrichtigungen */
export async function loanInfo(tx: Tx, id: string): Promise<LoanInfo> {
  const [row] = await tx<LoanInfo[]>`
    select l.id, l.kind, l.status, e.title, l.owner_id, l.borrower_id, l.copy_id, l.due_at, l.wanted::text as wanted,
           o.first_name as owner_name, b.first_name as borrower_name
      from loans l
      join copies c on c.id = l.copy_id
      join editions e on e.id = c.edition_id
      join users o on o.id = l.owner_id
      join users b on b.id = l.borrower_id
     where l.id = ${id}`;
  return row;
}

export function withTx<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(fn) as Promise<T>;
}
