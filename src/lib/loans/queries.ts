/** Lesende Sichten auf Vorgänge: Übersicht «Meine Vorgänge» und die Vorgangsseite. */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { parseRange } from "@/lib/dates";
import type { LoanRow } from "./core";
import { availableActions, type Action } from "./machine";
import { nextStep, type NextInput, type NextStep, type Turn } from "./next";
import { directionFor } from "./handover";
import { getCalendar } from "./calendar";

export type LoanListItem = {
  id: string;
  kind: LoanRow["kind"];
  status: LoanRow["status"];
  role: "owner" | "borrower";
  title: string;
  authors: string[];
  copy_id: string;
  work_id: string;
  other_name: string;
  other_id: string;
  wanted: string;
  due_at: Date | null;
  respond_by: Date;
  requested_at: Date;
  closed_at: Date | null;
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  cover_key: string | null;
  unread: number;
  step: NextStep;
  turn: Turn;
  waitingText: string | null;
};

type Joined = LoanRow & {
  title: string;
  authors: string[];
  owner_name: string;
  borrower_name: string;
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  cover_key: string | null;
  case_response: string | null;
  case_kind: string | null;
  rated_by_me: boolean;
  unread: number;
  pass_prev_borrower: string | null;
  work_id: string;
};

const JOINED = (userId: string) => sql`
  select l.*, l.wanted::text as wanted, w.title, w.authors, e.work_id, o.first_name as owner_name, b.first_name as borrower_name,
         ph.key as photo_key, ph.width as photo_w, ph.height as photo_h, e.cover_key,
         oc.response as case_response, oc.kind::text as case_kind,
         exists (select 1 from ratings r where r.loan_id = l.id and r.from_user = ${userId}) as rated_by_me,
         (select count(*)::int from notifications n where n.loan_id = l.id and n.user_id = ${userId} and n.channel = 'app' and n.read_at is null) as unread,
         (select p.borrower_id from loans p where p.id = l.pass_on_candidate_id) as pass_prev_borrower
    from loans l
    join copies c on c.id = l.copy_id
    join editions e on e.id = c.edition_id
    join works w on w.id = e.work_id
    join users o on o.id = l.owner_id
    join users b on b.id = l.borrower_id
    left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
    left join lateral (select response, kind from cases cs where cs.loan_id = l.id and cs.closed_at is null limit 1) oc on true`;

function passOnPendingFor(r: Joined, me: string) {
  if (!r.pass_on_candidate_id || r.received_from_loan_id) return false;
  if (me === r.owner_id) return r.pass_on_owner_ok == null;
  if (me === r.borrower_id) return r.pass_on_owner_ok === true && r.pass_on_next_ok == null;
  return false;
}

function stepFor(r: Joined, me: string) {
  const role = r.owner_id === me ? "owner" : "borrower";
  const input: NextInput = {
    ...r,
    role,
    me,
    case_response: r.case_response,
    case_kind: r.case_kind,
    rated_by_me: r.rated_by_me,
    pass_on_pending_mine: passOnPendingFor(r, me),
  };
  return { role, ...nextStep(input) } as const;
}

/** «Meine Vorgänge», nach Handlungsbedarf sortiert: zuerst, was auf mich wartet (PRD 7.4). */
export async function myLoans(userId: string): Promise<LoanListItem[]> {
  const rows = await sql<Joined[]>`
    ${JOINED(userId)}
     where (l.owner_id = ${userId} or l.borrower_id = ${userId})
       and (l.closed_at is null or l.closed_at > now() - interval '60 days' or l.status = 'lost')
     order by l.requested_at desc
     limit 200`;
  const items = rows.map((r) => {
    const s = stepFor(r, userId);
    return {
      id: r.id, kind: r.kind, status: r.status, role: s.role, title: r.title, authors: r.authors, copy_id: r.copy_id, work_id: r.work_id,
      other_name: s.role === "owner" ? r.borrower_name : r.owner_name, other_id: s.role === "owner" ? r.borrower_id : r.owner_id,
      wanted: r.wanted, due_at: r.due_at, respond_by: r.respond_by, requested_at: r.requested_at, closed_at: r.closed_at,
      photo_key: r.photo_key, photo_w: r.photo_w, photo_h: r.photo_h, cover_key: r.cover_key, unread: r.unread, step: s.step, turn: s.turn, waitingText: s.waitingText,
    } satisfies LoanListItem;
  });
  const rank = (i: LoanListItem) => (i.turn === "me" && i.step ? 0 : i.turn === "other" || i.turn === "system" ? 1 : 2);
  const deadline = (i: LoanListItem) =>
    (i.status === "requested" ? i.respond_by : i.due_at ?? new Date(parseRange(i.wanted)?.start ?? i.requested_at))?.valueOf() ?? 0;
  return items.sort((a, b) => rank(a) - rank(b) || deadline(a) - deadline(b));
}

/** Vorgangsseite: Zeitachse, nächster Schritt, Chat, Verlauf (PRD 8.4) */
export async function loanView(loanId: string, userId: string) {
  const [r] = await sql<Joined[]>`${JOINED(userId)} where l.id = ${loanId}`;
  if (!r) throw err.notFound("Diesen Vorgang gibt es nicht.");
  const isOwner = r.owner_id === userId;
  const isBorrower = r.borrower_id === userId;
  if (!isOwner && !isBorrower) throw err.notFound("Diesen Vorgang gibt es nicht.");
  const s = stepFor(r, userId);
  const otherId = isOwner ? r.borrower_id : r.owner_id;

  const [other] = await sql<{ id: string; first_name: string; trust_level: number; member_since: Date; lent: number; borrowed: number; punctual_pct: number | null; visible_losses: number; shared_circles: string[] }[]>`
    select u.id, u.first_name, u.trust_level, u.created_at as member_since, s.lent_count::int as lent, s.borrowed_count::int as borrowed,
           case when s.rated_count > 0 then round(100.0 * s.punctual_count / s.rated_count)::int end as punctual_pct,
           s.visible_losses::int as visible_losses,
           array(select c.name from circles c join circle_members a on a.circle_id = c.id and a.user_id = u.id and a.status = 'active'
                   join circle_members b on b.circle_id = c.id and b.user_id = ${userId} and b.status = 'active') as shared_circles
      from users u join user_stats s on s.user_id = u.id where u.id = ${otherId}`;

  const events = await sql<{ id: number; action: string; from_status: string | null; to_status: string; actor_name: string | null; actor_id: string | null; created_at: Date; meta: unknown }[]>`
    select e.id, e.action, e.from_status, e.to_status, u.first_name as actor_name, e.actor_id, e.created_at, e.meta
      from loan_events e left join users u on u.id = e.actor_id where e.loan_id = ${loanId} order by e.id`;

  // Übergabeort: der genaue Ort erst nach Annahme sichtbar (4.3)
  const [spot] = r.pickup_spot_id && r.status !== "requested"
    ? await sql<{ label: string; detail: string | null; dropoff: boolean }[]>`select label, detail, dropoff from pickup_spots where id = ${r.pickup_spot_id}`
    : [];
  const ownerSpots = isOwner
    ? await sql<{ id: string; label: string; detail: string | null; dropoff: boolean }[]>`select id, label, detail, dropoff from pickup_spots where user_id = ${userId} order by created_at`
    : [];
  const [circle] = r.circle_id ? await sql<{ id: string; name: string; fixed_spot: string | null }[]>`select id, name, fixed_spot from circles where id = ${r.circle_id}` : [];

  const [kase] = await sql<{ id: string; kind: string; stage: number; opened_at: Date; description: string | null; photo_keys: string[]; response: string | null; response_detail: string | null; return_planned_at: Date | null; outcome: string | null; closed_at: Date | null }[]>`
    select id, kind, stage, opened_at, description, photo_keys, response, response_detail, return_planned_at, outcome, closed_at
      from cases where loan_id = ${loanId} order by opened_at desc limit 1`;

  const swapOffered = r.kind === "swap"
    ? await sql<{ id: string; title: string; authors: string[]; condition: number; photo_key: string | null }[]>`
        select c.id, w.title, w.authors, c.condition,
               (select key from copy_photos p where p.copy_id = c.id order by position limit 1) as photo_key
          from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
         where c.id in ${sql(r.swap_offered_copy_ids.length ? r.swap_offered_copy_ids : ["00000000-0000-0000-0000-000000000000"])}`
    : [];
  const [swapOffer] = r.swap_offer_copy_id
    ? await sql<{ id: string; title: string; authors: string[]; condition: number }[]>`
        select c.id, w.title, w.authors, c.condition from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id where c.id = ${r.swap_offer_copy_id}`
    : [];

  // Folge- und Vorgängerleihen: Übergabe-Chat und direkte Weitergabe
  const [nextLoan] = await sql<{ id: string; borrower_name: string; start: string; pass_on_owner_ok: boolean | null; pass_on_prev_ok: boolean | null; pass_on_next_ok: boolean | null; received_from_loan_id: string | null; chat_id: string | null; status: string }[]>`
    select n.id, u.first_name as borrower_name, lower(n.wanted)::text as start, n.pass_on_owner_ok, n.pass_on_prev_ok, n.pass_on_next_ok,
           n.received_from_loan_id, hc.id as chat_id, n.status
      from loans n join users u on u.id = n.borrower_id
      left join handover_chats hc on hc.prev_loan_id = ${loanId} and hc.next_loan_id = n.id
     where n.copy_id = ${r.copy_id} and n.id <> ${loanId} and n.status = 'accepted'
       and (n.pass_on_candidate_id = ${loanId} or hc.id is not null)
     order by lower(n.wanted) limit 1`;
  const [prevChat] = await sql<{ id: string; prev_name: string }[]>`
    select hc.id, u.first_name as prev_name from handover_chats hc join loans p on p.id = hc.prev_loan_id join users u on u.id = p.borrower_id
     where hc.next_loan_id = ${loanId}`;
  const [waiting] = isBorrower && r.status === "active"
    ? await sql<{ name: string; start: string }[]>`
        select u.first_name as name, lower(b.period)::text as start from copy_bookings b join loans n on n.id = b.loan_id join users u on u.id = n.borrower_id
         where b.copy_id = ${r.copy_id} and n.status = 'accepted' and n.id <> ${loanId} order by lower(b.period) limit 1`
    : [];

  const [copySettings] = await sql<{ dropoff_allowed: boolean; auto_extend: boolean; max_extensions: number; loan_days: number }[]>`
    select dropoff_allowed, auto_extend, max_extensions, loan_days from copies where id = ${r.copy_id}`;

  const prev = r.received_from_loan_id
    ? (await sql<LoanRow[]>`select * from loans where id = ${r.received_from_loan_id}`)[0] ?? null
    : null;
  const myDirection = directionFor(r, userId, prev);

  // Eigene Tauschbücher (für «Behalten gegen Tausch»)
  const myOfferable = isBorrower && (r.status === "active" || r.status === "disputed")
    ? await sql<{ id: string; title: string }[]>`
        select c.id, w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
         where c.owner_id = ${userId} and c.removed_at is null
           and not exists (select 1 from loans x where x.copy_id = c.id and x.status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed'))
         order by w.title limit 100`
    : [];

  const calendar = isOwner ? await getCalendar(sql, r.copy_id, userId) : null;

  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    role: s.role,
    step: s.step,
    turn: s.turn,
    waitingText: s.waitingText,
    actions: availableActions(r.status, s.role, r.kind) as Action[],
    title: r.title,
    authors: r.authors,
    copyId: r.copy_id,
    workId: r.work_id,
    photo: r.photo_key ? { key: r.photo_key, w: r.photo_w, h: r.photo_h } : null,
    coverKey: r.cover_key,
    wanted: parseRange(r.wanted),
    message: r.message,
    times: {
      requested_at: r.requested_at, respond_by: r.respond_by, accepted_at: r.accepted_at, handover_by: r.handover_by,
      handed_over_at: r.handed_over_at, condition_note_until: r.condition_note_until, due_at: r.due_at, recalled_at: r.recalled_at,
      return_reported_at: r.return_reported_at, returned_at: r.returned_at, inspection_until: r.inspection_until, closed_at: r.closed_at,
      handover_reported_at: r.handover_reported_at, rating_closes_at: r.rating_closes_at,
    },
    received_from_loan_id: r.received_from_loan_id,
    handoverReportedBy: r.handover_reported_by,
    handoverMethod: r.handover_method,
    dropoffPhotoKey: r.dropoff_photo_key,
    conditionNote: r.condition_note,
    conditionPhotoKeys: r.condition_photo_keys,
    extensionsUsed: r.extensions_used,
    extensionRequested: Boolean(r.extension_requested_at),
    late: r.late,
    cancelledLate: r.cancelled_late,
    other,
    spot: spot ?? null,
    ownerSpots,
    circle: circle ?? null,
    case: kase ?? null,
    swapOffered,
    swapCopyId: r.swap_copy_id,
    swapScans: { owner: r.swap_scan_owner_at, borrower: r.swap_scan_borrower_at },
    swapOffer: swapOffer ?? null,
    nextLoan: nextLoan ?? null,
    prevChat: prevChat ?? null,
    passOn: r.pass_on_candidate_id
      ? { candidate: r.pass_on_candidate_id, agreed: Boolean(r.received_from_loan_id), owner: r.pass_on_owner_ok, prev: r.pass_on_prev_ok, next: r.pass_on_next_ok, pendingMine: passOnPendingFor(r, userId) }
      : null,
    waiting: waiting ?? null,
    copySettings,
    myDirection,
    myOfferable,
    ratedByMe: r.rated_by_me,
    calendar,
    events,
  };
}

export type LoanView = Awaited<ReturnType<typeof loanView>>;
