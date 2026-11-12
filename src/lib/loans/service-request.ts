/**
 * Vorgänge: Anfrage, Antwort des Verleihers, Storno.
 * Teil von ./service.ts (dort öffentlich exportiert).
 */
import { systemText } from "@/lib/notify/system-texts";
import { sql, PG, pgCode } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { addDays, diffDays, parseRange, todayCH } from "@/lib/dates";
import { assertBorrowerCapacity, assertWithinLimits, isBlockedBetween, requestBlocker } from "@/lib/trust";
import { rateLimit } from "@/lib/ratelimit";
import { getCalendar, fitsFree } from "./calendar";
import { getLoan, loanFor, loanInfo, logEvent, transition, type ActorRef, type LoanRow } from "./core";
import type { OfferKind } from "./machine";
import { afterAcceptConsecutive, onPassOnBroken, releaseFollowers } from "./passon";
import { SYSTEM, releaseBookings, offerEarlierStart } from "./service-shared";
import type { TxSql } from "./service-shared";

// ---------------------------------------------------------------------------
// Anfrage (4.2, 4.8, 5.1, 5.2)
// ---------------------------------------------------------------------------

export type RequestInput = {
  copyId: string;
  kind: OfferKind;
  start?: string;
  end?: string;          // exklusiv
  message?: string;
  swapOfferedCopyIds?: string[];
};

export async function requestLoan(user: SessionUser, input: RequestInput) {
  await rateLimit(`request:${user.id}`, 20, 3600);
  return sql.begin(async (tx) => {
    const blocker = await requestBlocker(tx, user);
    if (blocker) throw err.conflict("cannot_request", blocker);

    const [copy] = await tx<{
      id: string; owner_id: string; offers: OfferKind[]; loan_days: number; horizon_days: number;
      max_future_bookings: number; transfer_locked_until: Date | null; shelf_paused: boolean; visible: boolean;
      owner_banned: Date | null; owner_demo: boolean;
    }[]>`
      select c.id, c.owner_id, c.offers, c.loan_days, c.horizon_days, c.max_future_bookings, c.transfer_locked_until,
             o.shelf_paused, o.banned_at as owner_banned, o.is_demo as owner_demo, copy_visible_to(c.id, ${user.id}) as visible
        from copies c join users o on o.id = c.owner_id
       where c.id = ${input.copyId} and c.removed_at is null`;
    if (!copy || !copy.visible) throw err.notFound("Dieses Buch ist nicht mehr verfügbar.");
    if (copy.owner_id === user.id) throw err.invalid("Das ist dein eigenes Buch.");
    // Demo-Bestand: niemand antwortet, also gar nicht erst anfragen lassen
    if (copy.owner_demo)
      throw err.conflict("demo_copy", "Das ist ein Beispielbuch aus dem Demo-Bestand. Anfragen sind hier nicht möglich. Such dir ein Buch eines echten Mitglieds.");
    if (copy.shelf_paused) throw err.conflict("shelf_paused", "Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.");
    if (!copy.offers.includes(input.kind)) throw err.invalid("Dieses Buch wird so nicht angeboten.");
    if (input.kind !== "lend" && copy.transfer_locked_until && copy.transfer_locked_until > new Date())
      throw err.conflict("transfer_locked", "Dieses Buch wurde kürzlich verschenkt und kann noch nicht weitergegeben werden.");
    if (await isBlockedBetween(tx, user.id, copy.owner_id)) throw err.notFound("Dieses Buch ist nicht mehr verfügbar.");

    const [circle] = await tx<{ id: string; loan_days: number; auto_accept: boolean }[]>`
      select ci.id, ci.loan_days, ci.auto_accept from circles ci
       where ci.id = shared_circle_for_copy(${user.id}, ${copy.id})
         and exists (select 1 from circle_members m where m.circle_id = ci.id and m.user_id = ${copy.owner_id} and m.status = 'active')`;

    await assertWithinLimits(tx, user, Boolean(circle));

    const today = todayCH();
    let start = input.start ?? today;
    let end: string | null = input.end ?? null;

    if (input.kind === "lend") {
      const loanDays = circle?.loan_days ?? copy.loan_days;
      end ??= addDays(start, loanDays);
      if (start < today) throw err.invalid("Der Beginn liegt in der Vergangenheit.");
      if (diffDays(today, start) > copy.horizon_days)
        throw err.invalid(`Dieses Buch lässt sich höchstens ${copy.horizon_days} Tage im Voraus buchen.`);
      const days = diffDays(start, end);
      if (days < 1) throw err.invalid("Das Ende muss nach dem Beginn liegen.");
      if (days > loanDays) throw err.invalid(`Die Leihfrist für dieses Buch beträgt höchstens ${loanDays} Tage.`);
      const cal = await getCalendar(tx, copy.id, user.id, circle?.loan_days);
      if (cal && !fitsFree(cal.free, start, end))
        throw err.conflict("calendar_conflict", "Dieser Zeitraum ist im Verleihkalender bereits belegt. Wähle einen freien Zeitraum.");
      if (cal && start > today && cal.futureBookings >= cal.maxFutureBookings)
        throw err.conflict("calendar_full", "Für dieses Buch sind schon alle möglichen Termine gebucht. Versuche es nach der nächsten Rückgabe.");
    } else {
      start = today;
      end = null;
    }

    let offered: string[] = [];
    if (input.kind === "swap") {
      offered = [...new Set(input.swapOfferedCopyIds ?? [])];
      if (offered.length < 1 || offered.length > 5) throw err.invalid("Biete 1 bis 5 deiner Bücher zum Tausch an.");
      const own = await tx<{ id: string }[]>`
        select id from copies
         where id in ${tx(offered)} and owner_id = ${user.id} and removed_at is null
           and 'swap' = any(offers) and (transfer_locked_until is null or transfer_locked_until < now())`;
      if (own.length !== offered.length) throw err.invalid("Biete nur eigene Bücher an, die zum Tausch stehen.");
    }

    const [loan] = await tx<LoanRow[]>`
      insert into loans (kind, copy_id, owner_id, borrower_id, wanted, circle_id, message, swap_offered_copy_ids)
      values (${input.kind}, ${copy.id}, ${copy.owner_id}, ${user.id},
              daterange(${start}::date, ${end}::date), ${circle?.id ?? null}, ${input.message?.trim() || null},
              ${offered}::uuid[])
      returning *`;
    await logEvent(tx, loan.id, user.id, "request", null, "requested", { kind: input.kind });

    if (input.message?.trim()) {
      await tx`insert into messages (loan_id, sender_id, body) values (${loan.id}, ${user.id}, ${input.message.trim()})`;
    }

    const info = await loanInfo(tx, loan.id);
    await notify(tx, {
      userId: copy.owner_id,
      type: "request_new",
      loanId: loan.id,
      data: {
        title: info.title, name: info.borrower_name, kind: input.kind,
        ...(circle?.auto_accept && input.kind === "lend" ? systemText("circle_auto_accepted") : {}),
      },
    });

    // Kreise: Anfragen werden automatisch angenommen (PRD 3, Szenario 4)
    if (circle?.auto_accept && input.kind === "lend") {
      await acceptTx(tx, loan.id, SYSTEM, {});
      await notify(tx, { userId: user.id, type: "request_auto_accepted", loanId: loan.id, data: { title: info.title } });
    }
    return loan;
  });
}

// ---------------------------------------------------------------------------
// Antwort des Verleihers
// ---------------------------------------------------------------------------

export type AcceptInput = { pickupSpotId?: string | null; proposalAt?: string | null; proposalPlace?: string | null; swapCopyId?: string | null };

export async function accept(user: SessionUser, loanId: string, input: AcceptInput) {
  return sql.begin(async (tx) => {
    const loan = await acceptTx(tx, loanId, { role: "owner", id: user.id }, input);
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.borrower_id, type: "request_accepted", loanId, data: { title: info.title, name: info.owner_name } });
    return loan;
  });
}

async function acceptTx(tx: TxSql, loanId: string, actor: ActorRef, input: AcceptInput) {
  const current = await getLoan(tx, loanId);
  if (!current) throw err.notFound("Diesen Vorgang gibt es nicht.");

  let spotId: string | null = null;
  if (input.pickupSpotId) {
    const [spot] = await tx<{ id: string }[]>`select id from pickup_spots where id = ${input.pickupSpotId} and user_id = ${current.owner_id}`;
    if (!spot) throw err.invalid("Wähle einen deiner Übergabeorte.");
    spotId = spot.id;
  }

  // Das Exemplar muss noch der verleihenden Person gehören (z. B. nicht inzwischen verschenkt)
  const [own] = await tx<{ id: string }[]>`
    select id from copies where id = ${current.copy_id} and owner_id = ${current.owner_id} and removed_at is null for update`;
  if (!own) throw err.conflict("copy_gone", "Dieses Buch ist nicht mehr in deinem Regal. Die Anfrage lässt sich nicht annehmen.");

  let swapCopy: string | null = null;
  if (current.kind === "swap") {
    swapCopy = input.swapCopyId ?? null;
    if (!swapCopy || !current.swap_offered_copy_ids.includes(swapCopy))
      throw err.invalid("Wähle eines der angebotenen Bücher.");
    // Das Gegenstück muss noch der anderen Person gehören und tauschbar sein
    const [ok] = await tx<{ id: string }[]>`
      select id from copies
       where id = ${swapCopy} and owner_id = ${current.borrower_id} and removed_at is null and 'swap' = any(offers)
         and (transfer_locked_until is null or transfer_locked_until < now())
       for update`;
    if (!ok) throw err.conflict("swap_gone", "Dieses Tauschbuch ist nicht mehr verfügbar. Wähle ein anderes.");
  }

  if (current.kind === "lend") await assertBorrowerCapacity(tx, current.borrower_id, Boolean(current.circle_id));

  // Künftige Buchungen pro Exemplar begrenzen (4.8)
  const range = parseRange(current.wanted)!;
  if (current.kind === "lend" && range.start > todayCH()) {
    const [c] = await tx<{ n: number; max: number }[]>`
      select count(*)::int as n, (select max_future_bookings from copies where id = ${current.copy_id}) as max
        from copy_bookings where copy_id = ${current.copy_id} and loan_id is not null and lower(period) > today_ch()`;
    if (c.n >= c.max) throw err.conflict("calendar_full", "Für dieses Buch sind schon alle möglichen Termine gebucht.");
  }

  // Die Annahme als eine Anweisung (PRD 9.3), erweitert um Fristen und Tausch.
  const loan = await transition(tx, loanId, actor.role === "system" ? "auto_accept" : "accept", actor, {
    set: tx`accepted_at = now(),
            pickup_spot_id = ${spotId},
            swap_copy_id = ${swapCopy},
            handover_by = day_start_ch(lower(l.wanted) + 8)`,
    where: tx`l.respond_by > now()`,
  });

  try {
    await tx.savepoint(async (sp) => {
      await sp`
        insert into copy_bookings (copy_id, loan_id, period, buffer_days)
        select l.copy_id, l.id, l.wanted, case when l.kind = 'lend' then c.buffer_days else 0 end
          from loans l join copies c on c.id = l.copy_id where l.id = ${loanId}`;
      if (swapCopy) {
        await sp`insert into copy_bookings (copy_id, loan_id, period, buffer_days, note)
                 values (${swapCopy}, null, daterange(today_ch(), null), 0, ${"Tausch " + loanId})`;
      }
    });
  } catch (e) {
    if (pgCode(e) === PG.EXCLUSION)
      throw err.conflict("calendar_conflict", "Der Zeitraum ist inzwischen belegt. Lehne die Anfrage ab oder bitte um einen anderen Zeitraum.");
    throw e;
  }

  if (input.proposalAt) {
    await tx`insert into messages (loan_id, sender_id, proposal_place, proposal_at, proposal_status, proposal_accepted_by)
             values (${loanId}, ${loan.owner_id}, ${input.proposalPlace ?? null}, ${input.proposalAt}, 'open', array[${loan.owner_id}]::uuid[])`;
  }

  if (loan.kind === "lend") await afterAcceptConsecutive(tx, loan);
  return loan;
}

export async function decline(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const loan = await transition(tx, loanId, "decline", { role: "owner", id: user.id }, { set: tx`closed_at = now()` });
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.borrower_id, type: "request_declined", loanId, data: { title: info.title } });
    return loan;
  });
}

export async function withdraw(user: SessionUser, loanId: string) {
  return sql.begin((tx) =>
    transition(tx, loanId, "withdraw", { role: "borrower", id: user.id }, { set: tx`closed_at = now()` }),
  );
}

// ---------------------------------------------------------------------------
// Stornieren vor der Übergabe (4.8)
// ---------------------------------------------------------------------------

export async function cancel(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan: current, role } = await loanFor(tx, loanId, user.id);
    const start = parseRange(current.wanted)!.start;
    const daysToStart = diffDays(todayCH(), start);
    // Leiher: weniger als 48 h vor Beginn zählt wie unpünktlich. Verleiher: weniger als 7 Tage.
    const late = role === "borrower" ? daysToStart < 2 : daysToStart < 7;
    const loan = await transition(tx, loanId, "cancel", { role: role!, id: user.id }, {
      set: tx`closed_at = now(), cancelled_by = ${user.id}, cancelled_late = ${late}`,
    });
    await releaseBookings(tx, loan);
    if (loan.received_from_loan_id) await onPassOnBroken(tx, loan);
    await releaseFollowers(tx, loanId, "cancelled");
    const info = await loanInfo(tx, loanId);
    const other = role === "owner" ? loan.borrower_id : loan.owner_id;
    await notify(tx, {
      userId: other,
      type: "cancelled",
      loanId,
      data: { title: info.title, name: role === "owner" ? info.owner_name : info.borrower_name },
    });
    await offerEarlierStart(tx, loan.copy_id);
    return loan;
  });
}
