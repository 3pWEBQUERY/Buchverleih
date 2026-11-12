/**
 * Vorgänge: frühere Rückgabe, Streitfälle, Tausch und Bewertung.
 * Teil von ./service.ts (dort öffentlich exportiert).
 */
import { systemText } from "@/lib/notify/system-texts";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { addDays, diffDays, parseRange, todayCH } from "@/lib/dates";
import { getLoan, loanFor, loanInfo, logEvent, transition, type ActorRef } from "./core";
import { onPassOnBroken, releaseFollowers } from "./passon";
import { SYSTEM, releaseBookings, tryMoveBooking, transferOwnership, assertOwnPhotos, offerEarlierStart, pauseFutureBookings, resumePausedBookings, liftSuspensionIfClear } from "./service-shared";
import { cancelTx } from "./service-request";
import type { TxSql } from "./service-shared";

// ---------------------------------------------------------------------------
// Frühere Rückgabe: nächste Person darf früher beginnen (4.6, 4.8)
// ---------------------------------------------------------------------------

/** Die wartende Person nimmt das Angebot an und beginnt früher. */
export async function startEarlier(user: SessionUser, loanId: string, start: string) {
  return sql.begin(async (tx) => {
    const { loan } = await loanFor(tx, loanId, user.id);
    if (loan.borrower_id !== user.id || loan.status !== "accepted") throw err.stale();
    const r = parseRange(loan.wanted)!;
    if (start >= r.start || start < todayCH()) throw err.invalid("Wähle einen Tag vor dem bisherigen Beginn.");
    const duration = diffDays(r.start, r.end!);
    const end = addDays(start, duration);
    if (!(await tryMoveBooking(tx, loanId, start, end)) && !(await tryMoveBooking(tx, loanId, start, r.end!)))
      throw err.conflict("calendar_conflict", "Dieser Tag ist nicht mehr frei.");
    await tx`update loans set wanted = (select period from copy_bookings where loan_id = ${loanId}),
                              handover_by = day_start_ch(${start}::date + 8) where id = ${loanId} and status = 'accepted'`;
    await logEvent(tx, loanId, user.id, "start_earlier", "accepted", "accepted", { start });
    return getLoan(tx, loanId);
  });
}

/** Die wartende Person verschiebt, verkürzt oder storniert ohne Nachteil (4.8). */
export async function reschedule(user: SessionUser, loanId: string, start: string, end: string) {
  return sql.begin(async (tx) => {
    const { loan } = await loanFor(tx, loanId, user.id);
    if (loan.borrower_id !== user.id || loan.status !== "accepted") throw err.stale();
    if (start < todayCH() || end <= start) throw err.invalid("Wähle einen gültigen Zeitraum.");
    // Im Kreis gilt dessen Leihfrist, sonst die des Exemplars; dazu der Buchungshorizont
    const [c] = await tx<{ loan_days: number; horizon_days: number }[]>`
      select coalesce(ci.loan_days, cp.loan_days) as loan_days, cp.horizon_days
        from copies cp left join circles ci on ci.id = ${loan.circle_id}
       where cp.id = ${loan.copy_id}`;
    if (diffDays(start, end) > c.loan_days) throw err.invalid(`Die Leihfrist beträgt höchstens ${c.loan_days} Tage.`);
    if (diffDays(todayCH(), start) > c.horizon_days) throw err.invalid(`Dieses Buch lässt sich höchstens ${c.horizon_days} Tage im Voraus buchen.`);
    if (!(await tryMoveBooking(tx, loanId, start, end))) throw err.conflict("calendar_conflict", "Dieser Zeitraum ist nicht frei.");
    await tx`update loans set wanted = daterange(${start}::date, ${end}::date), handover_by = day_start_ch(${start}::date + 8)
              where id = ${loanId} and status = 'accepted'`;
    await logEvent(tx, loanId, user.id, "reschedule", "accepted", "accepted", { start, end });
    return getLoan(tx, loanId);
  });
}

/** Storno ohne Nachteil, wenn die Vorgänger-Leihe nicht rechtzeitig zurück ist. */
export async function cancelWithoutPenalty(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan: current } = await loanFor(tx, loanId, user.id);
    if (current.borrower_id !== user.id) throw err.forbidden();
    const [blocked] = await tx<{ n: number }[]>`
      select count(*)::int as n from copy_bookings b join loans p on p.id = b.loan_id
       where b.copy_id = ${current.copy_id} and p.id <> ${loanId}
         and p.status in ('active', 'disputed') and p.due_at <= day_start_ch(lower(${current.wanted}::daterange))
         and p.due_at < now()`;
    const [paused] = await tx<{ paused: boolean }[]>`select paused from copy_bookings where loan_id = ${loanId}`;
    if (!blocked.n && !paused?.paused) return cancelTx(tx, user, loanId);
    const loan = await transition(tx, loanId, "cancel", { role: "borrower", id: user.id }, {
      set: tx`closed_at = now(), cancelled_by = ${user.id}, cancelled_late = false`,
      meta: { reason: "predecessor_late" },
    });
    await releaseBookings(tx, loan);
    if (loan.received_from_loan_id) await onPassOnBroken(tx, loan);
    await releaseFollowers(tx, loanId, "cancelled");
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.owner_id, type: "cancelled", loanId, data: { title: info.title, name: info.borrower_name } });
    await offerEarlierStart(tx, loan.copy_id);
    return loan;
  });
}


// ---------------------------------------------------------------------------
// Streitfälle (4.5, 6.2, 6.3)
// ---------------------------------------------------------------------------

export async function reportDamage(user: SessionUser, loanId: string, input: { description: string; photoKeys: string[] }) {
  return sql.begin(async (tx) => {
    const photos = await assertOwnPhotos(tx, user.id, loanId, input.photoKeys, "case");
    const loan = await transition(tx, loanId, "report_damage", { role: "owner", id: user.id }, {
      where: tx`l.inspection_until > now()`,
    });
    const [c] = await tx<{ id: string }[]>`
      insert into cases (loan_id, kind, opened_by, description, photo_keys)
      values (${loanId}, 'damage', ${user.id}, ${input.description}, ${photos}::text[]) returning id`;
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.borrower_id, type: "damage_reported", loanId, data: { title: info.title } });
    return { loan, caseId: c.id };
  });
}

/**
 * Fall wegen ausbleibender Rückgabe. Verleiher ab 7 Tagen Verzug, oder sofort,
 * wenn die Kulanz aufgebraucht ist und jemand wartet (4.8). System nach 21 Tagen.
 */
export async function openCaseTx(tx: TxSql, loanId: string, actor: ActorRef, description?: string) {
  const where =
    actor.role === "system"
      ? tx`l.due_at < now() - interval '21 days'`
      : tx`(l.due_at < now() - interval '7 days'
            or (l.due_at < now() - interval '3 days' and exists (
                select 1 from copy_bookings b join loans n on n.id = b.loan_id
                 where b.copy_id = l.copy_id and n.id <> l.id and n.status = 'accepted' and lower(b.period) <= today_ch())))`;
  const loan = await transition(tx, loanId, actor.role === "system" ? "auto_open_case" : "open_case", actor, { where });
  const [c] = await tx<{ id: string }[]>`
    insert into cases (loan_id, kind, opened_by, description)
    values (${loanId}, 'nonreturn', ${actor.id}, ${description ?? null}) returning id`;
  await pauseFutureBookings(tx, loan.copy_id, loan.id);
  const info = await loanInfo(tx, loanId);
  await notify(tx, { userId: loan.borrower_id, type: "case_opened", loanId, data: { title: info.title } });
  if (actor.role === "system") await notify(tx, { userId: loan.owner_id, type: "case_opened", loanId, data: { title: info.title } });
  return { loan, caseId: c.id };
}

export async function openCase(user: SessionUser, loanId: string, description?: string) {
  return sql.begin((tx) =>
    openCaseTx(tx, loanId, { role: "owner", id: user.id }, description).catch(async (e) => {
      if (e?.code === "stale") {
        const l = await getLoan(tx, loanId);
        if (l?.status === "active")
          throw err.conflict("too_early", "Einen Fall kannst du ab 7 Tagen Verzug eröffnen, oder ab 3 Tagen, wenn jemand auf das Buch wartet.");
      }
      throw e;
    }),
  );
}


export type CaseResponse = "return_date" | "replace_same" | "replace_other" | "swap_offer" | "object";

export async function respondToCase(
  user: SessionUser,
  caseId: string,
  input: { response: CaseResponse; detail?: string; returnAt?: string; swapCopyId?: string },
) {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; loan_id: string; kind: "damage" | "nonreturn"; closed_at: Date | null }[]>`
      select c.id, c.loan_id, c.kind, c.closed_at from cases c join loans l on l.id = c.loan_id
       where c.id = ${caseId} and l.borrower_id = ${user.id}`;
    if (!c || c.closed_at) throw err.notFound("Diesen offenen Fall gibt es nicht.");
    const allowed: CaseResponse[] =
      c.kind === "damage" ? ["replace_same", "replace_other", "object"] : ["return_date", "replace_same", "replace_other", "swap_offer"];
    if (!allowed.includes(input.response)) throw err.invalid("Diese Antwort passt nicht zu diesem Fall.");
    if (input.response === "swap_offer") {
      if (!input.swapCopyId) throw err.invalid("Wähle eines deiner Bücher.");
      await offerSwapTx(tx, user, c.loan_id, input.swapCopyId, true);
    }
    await tx`
      update cases set response = ${input.response}, response_detail = ${input.detail ?? null},
             response_at = now(), return_planned_at = ${input.returnAt ?? null}
       where id = ${caseId}`;
    const info = await loanInfo(tx, c.loan_id);
    await tx`insert into messages (loan_id, sender_id, body) values (${c.loan_id}, null,
             ${`Antwort im Fall: ${input.response === "return_date" ? "Rückgabe geplant" : input.response === "object" ? "Widerspruch, die Moderation entscheidet" : "Ersatz angeboten"}${input.detail ? ` – ${input.detail}` : ""}`})`;
    await notify(tx, { userId: info.owner_id, type: "case_response", loanId: c.loan_id, data: { title: info.title, ...systemText(input.response === "return_date" ? "case_return_date" : input.response === "object" ? "case_object" : "case_replace") } });
  });
}

/** Verleiher bestätigt Ersatz oder Moderation entscheidet. */
export async function resolveCaseTx(
  tx: TxSql,
  caseId: string,
  actor: ActorRef,
  outcome: "returned" | "replaced" | "rejected",
  note?: string,
) {
  const [c] = await tx<{ loan_id: string; kind: string }[]>`select loan_id, kind from cases where id = ${caseId} and closed_at is null`;
  if (!c) throw err.notFound("Dieser Fall ist bereits geschlossen.");
  const loan = await transition(tx, c.loan_id, "resolve_case", actor, {
    // Ersatz statt Rückgabe oder eine Rückgabe nach Ablauf gilt nicht als pünktlich
    set: tx`closed_at = now(), rating_closes_at = now() + interval '14 days', returned_at = coalesce(l.returned_at, now()),
            late = l.late or ${outcome === "replaced"} or (l.due_at is not null and coalesce(l.returned_at, now()) > l.due_at + interval '3 days')`,
    meta: { outcome },
  });
  await tx`update cases set outcome = ${outcome}, closed_at = now(), moderator_id = ${actor.role === "moderator" ? actor.id : null},
                            moderator_note = ${note ?? null} where id = ${caseId}`;
  await tx`delete from copy_bookings where loan_id = ${loan.id} and upper(period) > today_ch()`;
  await resumePausedBookings(tx, loan.copy_id);
  // Eine vereinbarte direkte Weitergabe ist mit dem Fall hinfällig: die nächste Person holt bei der verleihenden Person ab
  await releaseFollowers(tx, loan.id, "case_resolved");
  await liftSuspensionIfClear(tx, loan.borrower_id);
  await tx`select recompute_trust(${loan.borrower_id})`;
  await offerEarlierStart(tx, loan.copy_id);
  const info = await loanInfo(tx, loan.id);
  const text = systemText(outcome === "replaced" ? "case_replaced" : outcome === "rejected" ? "case_rejected" : "case_returned");
  for (const uid of [loan.owner_id, loan.borrower_id]) await notify(tx, { userId: uid, type: "case_resolved", loanId: loan.id, data: { title: info.title, ...text } });
  return loan;
}

export async function resolveCase(user: SessionUser, caseId: string, outcome: "returned" | "replaced") {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ owner_id: string }[]>`select l.owner_id from cases c join loans l on l.id = c.loan_id where c.id = ${caseId}`;
    if (!c || c.owner_id !== user.id) throw err.notFound("Diesen Fall gibt es nicht.");
    return resolveCaseTx(tx, caseId, { role: "owner", id: user.id }, outcome);
  });
}

/** Tag 30: Fall wird als verloren geschlossen, Exemplar verlässt das Regal (6.3). */
export async function markLostTx(tx: TxSql, caseId: string, actor: ActorRef) {
  const [c] = await tx<{ loan_id: string }[]>`select loan_id from cases where id = ${caseId} and closed_at is null`;
  if (!c) throw err.notFound();
  const loan = await transition(tx, c.loan_id, "mark_lost", actor, { set: tx`closed_at = now()` });
  await tx`update cases set outcome = 'lost', closed_at = now(), stage = 3 where id = ${caseId}`;
  await tx`update copies set removed_at = now(), removed_reason = 'lost' where id = ${loan.copy_id}`;
  // Künftige Buchungen anderer entfallen
  const future = await tx<{ id: string }[]>`
    select l.id from loans l where l.copy_id = ${loan.copy_id} and l.status in ('accepted', 'requested') and l.id <> ${loan.id}`;
  for (const f of future) {
    const cur = await getLoan(tx, f.id);
    const action = cur?.status === "requested" ? "expire_request" : "expire_handover";
    const l2 = await transition(tx, f.id, action, SYSTEM, { set: tx`closed_at = now()`, meta: { reason: "copy_lost" } });
    await tx`delete from copy_bookings where loan_id = ${f.id}`;
    const info2 = await loanInfo(tx, f.id);
    await notify(tx, { userId: l2.borrower_id, type: "cancelled", loanId: f.id, data: { title: info2.title } }); // ohne Namen: Text nennt «die andere Seite» in der Sprache der Person
  }
  await tx`delete from copy_bookings where copy_id = ${loan.copy_id}`;
  // Sperre der Nummer bei Verlust (6.5)
  await tx`insert into banned_phones (phone_e164, reason)
           select phone_e164, ${"Verlust " + loan.id} from users where id = ${loan.borrower_id} and phone_e164 is not null
           on conflict do nothing`;
  await tx`select recompute_trust(${loan.borrower_id})`;
  const info = await loanInfo(tx, loan.id);
  for (const uid of [loan.owner_id, loan.borrower_id]) await notify(tx, { userId: uid, type: "case_lost", loanId: loan.id, data: { title: info.title } });
  return loan;
}

/** Ein geschlossener Verlust kann nachträglich durch Rückgabe oder Ersatz bereinigt werden. */
export async function clearLossTx(tx: TxSql, loanId: string, actor: ActorRef) {
  const loan = await transition(tx, loanId, "clear_loss", actor, { set: tx`returned_at = now(), late = true` });
  await tx`update cases set cleared_at = now() where loan_id = ${loanId} and outcome = 'lost'`;
  await tx`update copies set removed_at = null, removed_reason = null where id = ${loan.copy_id} and removed_reason = 'lost'`;
  await tx`delete from banned_phones where reason = ${"Verlust " + loanId}`;
  await liftSuspensionIfClear(tx, loan.borrower_id);
  await tx`select recompute_trust(${loan.borrower_id})`;
  return loan;
}

export async function clearLoss(user: SessionUser, loanId: string) {
  return sql.begin((tx) => clearLossTx(tx, loanId, { role: "owner", id: user.id }));
}

// ---------------------------------------------------------------------------
// Leihe wird zum Tausch (5.4)
// ---------------------------------------------------------------------------

async function offerSwapTx(tx: TxSql, user: SessionUser, loanId: string, copyId: string, fromCase = false) {
  const [own] = await tx<{ id: string }[]>`
    select id from copies where id = ${copyId} and owner_id = ${user.id} and removed_at is null
       and not exists (select 1 from loans where copy_id = ${copyId} and status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed'))`;
  if (!own) throw err.invalid("Wähle eines deiner Bücher, das gerade nicht verliehen oder gebucht ist.");
  if (fromCase) {
    await tx`update loans set swap_offer_copy_id = ${copyId} where id = ${loanId} and borrower_id = ${user.id}`;
    await logEvent(tx, loanId, user.id, "offer_swap", "disputed", "disputed", { copyId });
    return;
  }
  await transition(tx, loanId, "offer_swap", { role: "borrower", id: user.id }, { set: tx`swap_offer_copy_id = ${copyId}` });
  const info = await loanInfo(tx, loanId);
  await notify(tx, { userId: info.owner_id, type: "swap_offer", loanId, data: { title: info.title, name: info.borrower_name } });
}

export async function offerSwap(user: SessionUser, loanId: string, copyId: string) {
  return sql.begin((tx) => offerSwapTx(tx, user, loanId, copyId));
}

export async function acceptSwapOffer(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const current = await getLoan(tx, loanId, true);
    if (!current?.swap_offer_copy_id) throw err.conflict("no_offer", "Es liegt kein Tauschangebot vor.");
    // Das angebotene Buch darf inzwischen nicht verliehen oder gebucht sein (sonst wechselt es den Besitz bei Dritten)
    const [free] = await tx<{ id: string }[]>`
      select id from copies where id = ${current.swap_offer_copy_id} and owner_id = ${current.borrower_id} and removed_at is null
         and not exists (select 1 from loans where copy_id = copies.id and status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed'))
       for update`;
    if (!free) throw err.conflict("offer_unavailable", "Das angebotene Buch ist inzwischen verliehen oder gebucht. Der Tausch ist so nicht mehr möglich.");
    const loan = await transition(tx, loanId, "convert_to_swap", { role: "owner", id: user.id }, {
      set: tx`closed_at = now(), returned_at = null, rating_closes_at = now() + interval '14 days'`,
    });
    await tx`update cases set outcome = 'swapped', closed_at = now() where loan_id = ${loanId} and closed_at is null`;
    // Künftige Buchungen anderer am bisher geliehenen Exemplar entfallen
    const future = await tx<{ id: string }[]>`
      select id from loans where copy_id = ${loan.copy_id} and status in ('requested', 'accepted') and id <> ${loanId}`;
    for (const f of future) {
      const cur = await getLoan(tx, f.id);
      const l2 = await transition(tx, f.id, cur?.status === "requested" ? "expire_request" : "expire_handover", SYSTEM, {
        set: tx`closed_at = now()`, meta: { reason: "converted_to_swap" },
      });
      await tx`delete from copy_bookings where loan_id = ${f.id}`;
      const i2 = await loanInfo(tx, f.id);
      await notify(tx, { userId: l2.borrower_id, type: "cancelled", loanId: f.id, data: { title: i2.title, name: i2.owner_name } });
    }
    await tx`delete from copy_bookings where loan_id = ${loanId}`;
    await transferOwnership(tx, loan.copy_id, loan.borrower_id, "swap", loan.owner_id);
    await transferOwnership(tx, loan.swap_offer_copy_id!, loan.owner_id, "swap", loan.borrower_id);
    await liftSuspensionIfClear(tx, loan.borrower_id);
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.borrower_id, type: "completed", loanId, data: { title: info.title } });
    await tx`select recompute_trust(${loan.borrower_id})`;
    await resumePausedBookings(tx, loan.copy_id);
    return loan;
  });
}

// ---------------------------------------------------------------------------
// Bewertung (6.4)
// ---------------------------------------------------------------------------

export async function rate(
  user: SessionUser,
  loanId: string,
  input: { verdict: "good" | "problems"; reasons: string[]; note?: string },
) {
  return sql.begin(async (tx) => {
    const { loan, role } = await loanFor(tx, loanId, user.id);
    // Vorgang sperren: geben beide gleichzeitig ab, sieht die zweite Transaktion die erste Bewertung
    await tx`select id from loans where id = ${loanId} for update`;
    const [mine] = await tx`select 1 from ratings where loan_id = ${loanId} and from_user = ${user.id}`;
    if (mine) throw err.conflict("already_rated", "Du hast diesen Vorgang bereits bewertet.");
    if (loan.status !== "completed" || !loan.rating_closes_at || loan.rating_closes_at < new Date())
      throw err.conflict("rating_closed", "Für diesen Vorgang ist keine Bewertung mehr möglich.");
    const forUser = role === "owner" ? loan.borrower_id : loan.owner_id;
    await tx`
      insert into ratings (loan_id, from_user, for_user, verdict, reasons, note, visible_from)
      values (${loanId}, ${user.id}, ${forUser}, ${input.verdict},
              ${input.verdict === "problems" ? input.reasons : []}::text[], ${input.note ?? null}, ${loan.rating_closes_at})`;
    // Sichtbar, sobald beide abgegeben haben, sonst nach 14 Tagen
    await tx`
      update ratings set visible_from = now()
       where loan_id = ${loanId} and (select count(*) from ratings where loan_id = ${loanId}) = 2`;
  });
}
