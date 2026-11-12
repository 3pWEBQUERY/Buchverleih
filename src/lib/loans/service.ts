/**
 * Vorgänge: alle Handlungen von Mitgliedern und alle Fristfolgen.
 * Jede Funktion leitet ihre Bedingungen aus ./machine.ts ab (über transition()).
 * API-Endpunkte und Worker rufen ausschliesslich diese Funktionen auf.
 */
import type postgres from "postgres";
import { sql, type Tx, PG, pgCode } from "@/lib/db";
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

type TxSql = postgres.TransactionSql;
const SYSTEM: ActorRef = { role: "system", id: null };

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
        ...(circle?.auto_accept && input.kind === "lend" ? { text: "Im Kreis automatisch angenommen. Sprecht Ort und Zeit im Vorgang ab." } : {}),
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

async function releaseBookings(tx: Tx, loan: LoanRow) {
  await tx`delete from copy_bookings where loan_id = ${loan.id}`;
  if (loan.swap_copy_id) {
    await tx`delete from copy_bookings where copy_id = ${loan.swap_copy_id} and loan_id is null and note = ${"Tausch " + loan.id}`;
  }
}

// ---------------------------------------------------------------------------
// Übergabe (4.3) – Ausführung nach Scan, Code, bestätigter Meldung oder Fristablauf
// ---------------------------------------------------------------------------

/**
 * Führt die Übergabe aus. Leihe: Leihfrist beginnt. Geschenk und Tausch: Besitzwechsel.
 * `action` ist handover (Scan/Code), confirm_handover oder handover_report_lapse.
 */
export async function executeHandover(
  tx: TxSql,
  loanId: string,
  action: "handover" | "confirm_handover" | "handover_report_lapse",
  actor: ActorRef,
  method: "scan" | "code" | "report" | "dropoff",
) {
  const current = await getLoan(tx, loanId, true);
  if (!current) throw err.notFound();
  const range = parseRange(current.wanted)!;
  const today = todayCH();

  // Übergabefenster: ab 3 Tage vor bis 7 Tage nach geplantem Beginn (4.8)
  if (current.kind === "lend" && diffDays(today, range.start) > 3)
    throw err.conflict("too_early", "Die Übergabe ist frühestens 3 Tage vor dem geplanten Beginn möglich.");

  const handedAt = action === "handover_report_lapse" && current.handover_reported_at ? current.handover_reported_at : new Date();

  if (current.kind === "lend") {
    // Beginn verschiebt sich auf heute; das Ende nur, wenn der Kalender danach frei ist.
    const duration = diffDays(range.start, range.end!);
    let newStart = range.start;
    let newEnd = range.end!;
    if (today < range.start) newStart = today;
    if (today > range.start) {
      newStart = today;
      newEnd = addDays(today, duration);
    }
    if (newStart !== range.start || newEnd !== range.end) {
      const moved = await tryMoveBooking(tx, loanId, newStart, newEnd);
      if (!moved) {
        // Ende bleibt, nur der Beginn rückt nach
        const startOnly = await tryMoveBooking(tx, loanId, today < range.start ? range.start : today, range.end!);
        if (!startOnly && today < range.start)
          throw err.conflict("too_early", "Das Buch ist bis zum geplanten Beginn noch gebucht.");
        newEnd = range.end!;
      }
    }

    const loan = await transition(tx, loanId, action, actor, {
      set: tx`handed_over_at = ${handedAt},
              handover_method = ${method},
              due_at = (select day_start_ch(upper(period)) from copy_bookings where loan_id = ${loanId}),
              wanted = (select period from copy_bookings where loan_id = ${loanId}),
              condition_note_until = ${handedAt}::timestamptz + interval '24 hours'`,
    });
    const info = await loanInfo(tx, loanId);
    for (const uid of [loan.owner_id, loan.borrower_id]) {
      await notify(tx, { userId: uid, type: "handover_done", loanId, data: { title: info.title, due: loan.due_at?.toISOString() } });
    }
    await closeHandoverChatsFor(tx, loan.id);
    return loan;
  }

  // Geschenk und Tausch: Besitzwechsel
  const loan = await transition(tx, loanId, action, actor, {
    set: tx`handed_over_at = ${handedAt}, handover_method = ${method}, closed_at = now(), rating_closes_at = now() + interval '14 days'`,
  });
  await transferOwnership(tx, loan.copy_id, loan.borrower_id, loan.kind, loan.owner_id);
  if (loan.kind === "swap" && loan.swap_copy_id) {
    await transferOwnership(tx, loan.swap_copy_id, loan.owner_id, "swap", loan.borrower_id);
  }
  // Andere offene Anfragen für dieses Exemplar verfallen
  const others = await tx<{ id: string }[]>`
    select id from loans where copy_id = ${loan.copy_id} and status = 'requested' and id <> ${loan.id}`;
  for (const o of others) {
    await transition(tx, o.id, "expire_request", SYSTEM, { set: tx`closed_at = now()`, meta: { reason: "copy_transferred" } });
  }
  const info = await loanInfo(tx, loanId);
  for (const uid of [loan.owner_id, loan.borrower_id]) {
    await notify(tx, { userId: uid, type: "handover_done", loanId, data: { title: info.title } });
  }
  return loan;
}

async function tryMoveBooking(tx: TxSql, loanId: string, start: string, end: string) {
  try {
    await tx.savepoint((sp) => sp`update copy_bookings set period = daterange(${start}::date, ${end}::date) where loan_id = ${loanId}`);
    return true;
  } catch (e) {
    if (pgCode(e) === PG.EXCLUSION) return false;
    throw e;
  }
}

/**
 * Besitzwechsel bei Tausch und Geschenk (5.1, 5.2). Das Exemplar erscheint im neuen Regal
 * als «nicht angeboten». Geschenke sind 30 Tage für Weitergabe gesperrt.
 */
async function transferOwnership(tx: Tx, copyId: string, newOwner: string, kind: OfferKind, fromOwner: string) {
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

// ---------------------------------------------------------------------------
// Einseitige Meldung und Ablage (4.3)
// ---------------------------------------------------------------------------

export async function reportHandover(user: SessionUser, loanId: string, input: { dropoffPhotoKey?: string | null }) {
  return sql.begin(async (tx) => {
    const { loan: current, role } = await loanFor(tx, loanId, user.id);
    if (current.handover_reported_at) throw err.conflict("already_reported", "Die Übergabe ist bereits gemeldet.");
    let action: "report_handover" | "dropoff" = "report_handover";
    if (input.dropoffPhotoKey) {
      const [c] = await tx<{ dropoff_allowed: boolean }[]>`select dropoff_allowed from copies where id = ${current.copy_id}`;
      if (!c.dropoff_allowed) throw err.invalid("Für dieses Buch ist keine Ablage erlaubt.");
      action = "dropoff";
    }
    const loan = await transition(tx, loanId, action, { role: role!, id: user.id }, {
      set: tx`handover_reported_at = now(), handover_reported_by = ${user.id},
              handover_method = ${action === "dropoff" ? "dropoff" : "report"},
              dropoff_photo_key = ${input.dropoffPhotoKey ?? null}`,
    });
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: role === "owner" ? loan.borrower_id : loan.owner_id, type: "handover_reported", loanId, data: { title: info.title } });
    return loan;
  });
}

export async function confirmHandover(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan, role } = await loanFor(tx, loanId, user.id);
    if (!loan.handover_reported_at || loan.handover_reported_by === user.id)
      throw err.conflict("nothing_to_confirm", "Es gibt keine Meldung der anderen Seite zu bestätigen.");
    return executeHandover(tx, loanId, "confirm_handover", { role: role!, id: user.id }, (loan.handover_method as "report" | "dropoff") ?? "report");
  });
}

export async function objectHandover(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan, role } = await loanFor(tx, loanId, user.id);
    if (!loan.handover_reported_at || loan.handover_reported_by === user.id)
      throw err.conflict("nothing_to_object", "Es gibt keine Meldung der anderen Seite.");
    return transition(tx, loanId, "object_handover", { role: role!, id: user.id }, {
      set: tx`handover_reported_at = null, handover_reported_by = null, handover_method = null, dropoff_photo_key = null`,
    });
  });
}

// ---------------------------------------------------------------------------
// Während der Leihe (4.4)
// ---------------------------------------------------------------------------

export async function addConditionNote(user: SessionUser, loanId: string, input: { note: string; photoKeys: string[] }) {
  return sql.begin((tx) =>
    transition(tx, loanId, "condition_note", { role: "borrower", id: user.id }, {
      set: tx`condition_note = ${input.note.trim() || null}, condition_photo_keys = ${input.photoKeys}::text[]`,
      where: tx`l.condition_note_until > now()`,
    }),
  );
}

/** Neues Ende bei Verlängerung: +14 Tage, höchstens bis zum Puffer vor der nächsten Buchung. */
async function extensionEnd(tx: Tx, loan: LoanRow): Promise<string | null> {
  const [b] = await tx<{ period: string; buffer_days: number }[]>`
    select period::text as period, buffer_days from copy_bookings where loan_id = ${loan.id}`;
  if (!b) return null;
  const p = parseRange(b.period)!;
  const [next] = await tx<{ start: string }[]>`
    select lower(period)::text as start from copy_bookings
     where copy_id = ${loan.copy_id} and lower(period) >= ${p.end}::date and id is distinct from (select id from copy_bookings where loan_id = ${loan.id})
     order by lower(period) limit 1`;
  let end = addDays(p.end!, 14);
  if (next) {
    const limit = addDays(next.start, -b.buffer_days);
    if (limit < end) end = limit;
  }
  return end > p.end! ? end : null;
}

export async function extend(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan } = await loanFor(tx, loanId, user.id);
    if (loan.borrower_id !== user.id) throw err.forbidden();
    const [copy] = await tx<{ auto_extend: boolean; max_extensions: number }[]>`
      select auto_extend, max_extensions from copies where id = ${loan.copy_id}`;
    if (loan.recalled_at) throw err.conflict("recalled", "Das Buch wurde zurückgerufen. Eine Verlängerung ist nicht mehr möglich.");
    // Nach Ablauf der Frist ist eine Verlängerung keine mehr: sonst würde eine verspätete Rückgabe nachträglich pünktlich
    if (loan.due_at && new Date(loan.due_at) < new Date())
      throw err.conflict("overdue", "Die Leihfrist ist abgelaufen. Bring das Buch zurück oder sprich dich im Chat ab.");
    if (loan.extensions_used >= copy.max_extensions)
      throw err.conflict("no_extensions", "Für diese Leihe sind keine weiteren Verlängerungen möglich.");
    const end = await extensionEnd(tx, loan);
    if (!end) throw err.conflict("calendar_next", "Direkt danach ist das Buch gebucht. Eine Verlängerung ist nicht möglich.");

    if (!copy.auto_extend) {
      if (loan.extension_requested_at) throw err.conflict("already_requested", "Du hast die Verlängerung bereits angefragt.");
      const l = await transition(tx, loanId, "request_extension", { role: "borrower", id: user.id }, { set: tx`extension_requested_at = now()` });
      const info = await loanInfo(tx, loanId);
      await notify(tx, { userId: l.owner_id, type: "extension_requested", loanId, data: { title: info.title, name: info.borrower_name } });
      return l;
    }
    return applyExtension(tx, loan, end, "extend", { role: "borrower", id: user.id });
  });
}

export async function grantExtension(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const { loan } = await loanFor(tx, loanId, user.id);
    if (!loan.extension_requested_at) throw err.conflict("nothing_requested", "Es liegt keine Anfrage für eine Verlängerung vor.");
    if (loan.recalled_at) throw err.conflict("recalled", "Du hast das Buch zurückgerufen. Eine Verlängerung passt nicht dazu.");
    const [copy] = await tx<{ max_extensions: number }[]>`select max_extensions from copies where id = ${loan.copy_id}`;
    if (copy && loan.extensions_used >= copy.max_extensions)
      throw err.conflict("no_extensions", "Für diese Leihe sind keine weiteren Verlängerungen möglich.");
    const end = await extensionEnd(tx, loan);
    if (!end) throw err.conflict("calendar_next", "Direkt danach ist das Buch gebucht.");
    return applyExtension(tx, loan, end, "grant_extension", { role: "owner", id: user.id });
  });
}

async function applyExtension(tx: TxSql, loan: LoanRow, end: string, action: "extend" | "grant_extension", actor: ActorRef) {
  await tx`update copy_bookings set period = daterange(lower(period), ${end}::date) where loan_id = ${loan.id}`;
  const l = await transition(tx, loan.id, action, actor, {
    set: tx`due_at = day_start_ch(${end}::date), extensions_used = l.extensions_used + 1, extension_requested_at = null,
            wanted = daterange(lower(l.wanted), ${end}::date)`,
    where: tx`l.extensions_used = ${loan.extensions_used}`,
    meta: { until: end },
  });
  const info = await loanInfo(tx, loan.id);
  await notify(tx, { userId: l.borrower_id, type: "extended", loanId: l.id, data: { title: info.title, due: l.due_at?.toISOString() } });
  return l;
}

/** Rückruf: frühestens nach 14 Tagen Leihdauer, Rückgabe innert 7 Tagen. Nicht abschaltbar. */
export async function recall(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const l = await transition(tx, loanId, "recall", { role: "owner", id: user.id }, {
      set: tx`recalled_at = now(), due_at = least(l.due_at, day_start_ch(today_ch() + 8))`,
      where: tx`l.recalled_at is null and l.handed_over_at <= now() - interval '14 days'`,
    }).catch(async (e) => {
      const loan = await getLoan(tx, loanId);
      if (loan?.status === "active" && loan.handed_over_at && loan.handed_over_at > new Date(Date.now() - 14 * 86400_000))
        throw err.conflict("too_early", "Ein Rückruf ist frühestens nach 14 Tagen Leihdauer möglich.");
      throw e;
    });
    await tx`update copy_bookings set period = daterange(lower(period), least(upper(period), today_ch() + 8))
             where loan_id = ${loanId}`;
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: l.borrower_id, type: "recalled", loanId, data: { title: info.title, name: info.owner_name, due: l.due_at?.toISOString() } });
    return l;
  });
}

// ---------------------------------------------------------------------------
// Rückgabe (4.3)
// ---------------------------------------------------------------------------

export async function executeReturn(
  tx: TxSql,
  loanId: string,
  action: "return" | "confirm_return" | "return_report_lapse",
  actor: ActorRef,
) {
  const current = await getLoan(tx, loanId, true);
  if (!current) throw err.notFound();
  const returnedAt = action === "return_report_lapse" && current.return_reported_at ? current.return_reported_at : new Date();
  const [openCase] = await tx<{ n: number }[]>`
    select count(*)::int as n from cases where loan_id = ${loanId} and kind = 'nonreturn' and closed_at is null`;
  const hadCase = openCase.n > 0;

  const loan = await transition(tx, loanId, action, actor, {
    set: tx`returned_at = ${returnedAt},
            inspection_until = ${returnedAt}::timestamptz + interval '48 hours',
            late = (${returnedAt}::timestamptz > l.due_at + interval '3 days')`,
    // Aus «Fall offen» nur bei ausbleibender Rückgabe, nicht bei einem Schadenfall
    where: tx`(l.status <> 'disputed' or ${hadCase})`,
  });
  // Kalender freigeben: Buchung endet mit dem Rückgabetag
  await tx`update copy_bookings
              set period = daterange(lower(period), greatest(lower(period) + 1, least(upper(period), today_ch() + 1)))
            where loan_id = ${loanId}`;
  if (hadCase) {
    await tx`update cases set outcome = 'returned', closed_at = now() where loan_id = ${loanId} and kind = 'nonreturn' and closed_at is null`;
    await resumePausedBookings(tx, loan.copy_id);
    await liftSuspensionIfClear(tx, loan.borrower_id);
  }
  // Kam das Buch zur verleihenden Person zurück, geht eine vereinbarte Weitergabe nicht mehr direkt
  await releaseFollowers(tx, loanId, "returned_to_owner");
  const info = await loanInfo(tx, loanId);
  await notify(tx, { userId: loan.borrower_id, type: "returned", loanId, data: { title: info.title } });
  await offerEarlierStart(tx, loan.copy_id);
  return loan;
}

export async function reportReturn(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const loan = await transition(tx, loanId, "report_return", { role: "borrower", id: user.id }, {
      set: tx`return_reported_at = now(), return_reported_by = ${user.id}`,
      where: tx`(l.status <> 'disputed' or exists (select 1 from cases c where c.loan_id = l.id and c.kind = 'nonreturn' and c.closed_at is null))`,
    });
    const info = await loanInfo(tx, loanId);
    await notify(tx, { userId: loan.owner_id, type: "return_reported", loanId, data: { title: info.title } });
    return loan;
  });
}

export async function confirmReturn(user: SessionUser, loanId: string) {
  return sql.begin((tx) => executeReturn(tx, loanId, "confirm_return", { role: "owner", id: user.id }));
}

export async function objectReturn(user: SessionUser, loanId: string) {
  return sql.begin((tx) =>
    transition(tx, loanId, "object_return", { role: "owner", id: user.id }, {
      set: tx`return_reported_at = null, return_reported_by = null`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Prüfung und Abschluss (4.2, 6.2)
// ---------------------------------------------------------------------------

export async function completeTx(tx: TxSql, loanId: string, actor: ActorRef) {
  const loan = await transition(tx, loanId, "complete", actor, {
    set: tx`closed_at = now(), rating_closes_at = now() + interval '14 days'`,
  });
  await tx`select recompute_trust(${loan.borrower_id})`;
  const info = await loanInfo(tx, loanId);
  for (const uid of [loan.owner_id, loan.borrower_id]) {
    await notify(tx, { userId: uid, type: "completed", loanId, data: { title: info.title } });
  }
  await maybeInviteOwnBooks(tx, loan.borrower_id);
  return loan;
}

export async function complete(user: SessionUser, loanId: string) {
  return sql.begin((tx) => completeTx(tx, loanId, { role: "owner", id: user.id }));
}

/** Gegenseitigkeit (4.7): nach der zweiten Leihe einmal einladen, eigene Bücher einzustellen. */
async function maybeInviteOwnBooks(tx: Tx, userId: string) {
  const [r] = await tx<{ borrowed: number; own: number; prompted: Date | null }[]>`
    select (select count(*)::int from loans where borrower_id = ${userId} and status = 'completed') as borrowed,
           (select count(*)::int from copies where owner_id = ${userId} and removed_at is null) as own,
           (select own_books_prompted_at from users where id = ${userId}) as prompted`;
  if (r.borrowed >= 2 && r.own === 0 && !r.prompted) {
    await tx`update users set own_books_prompted_at = now() where id = ${userId}`;
    await notify(tx, { userId, type: "invite_own_books", data: {} });
  }
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
                              handover_by = day_start_ch(${start}::date + 8) where id = ${loanId}`;
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
    if (!blocked.n && !paused?.paused) return cancel(user, loanId);
    const loan = await transition(tx, loanId, "cancel", { role: "borrower", id: user.id }, {
      set: tx`closed_at = now(), cancelled_by = ${user.id}, cancelled_late = false`,
      meta: { reason: "predecessor_late" },
    });
    await releaseBookings(tx, loan);
    return loan;
  });
}

// ---------------------------------------------------------------------------
// Streitfälle (4.5, 6.2, 6.3)
// ---------------------------------------------------------------------------

export async function reportDamage(user: SessionUser, loanId: string, input: { description: string; photoKeys: string[] }) {
  return sql.begin(async (tx) => {
    const loan = await transition(tx, loanId, "report_damage", { role: "owner", id: user.id }, {
      where: tx`l.inspection_until > now()`,
    });
    const [c] = await tx<{ id: string }[]>`
      insert into cases (loan_id, kind, opened_by, description, photo_keys)
      values (${loanId}, 'damage', ${user.id}, ${input.description}, ${input.photoKeys}::text[]) returning id`;
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

/** Fall eröffnet oder Buch verloren: alle künftigen Buchungen werden pausiert, die Betroffenen informiert (4.8). */
async function pauseFutureBookings(tx: Tx, copyId: string, exceptLoan: string) {
  const rows = await tx<{ loan_id: string; borrower_id: string; title: string }[]>`
    update copy_bookings b set paused = true
      from loans l, copies c, editions e
     where b.copy_id = ${copyId} and b.loan_id = l.id and l.id <> ${exceptLoan} and l.status = 'accepted'
       and c.id = b.copy_id and e.id = c.edition_id and not b.paused
    returning b.loan_id, l.borrower_id, e.title`;
  for (const r of rows) await notify(tx, { userId: r.borrower_id, type: "bookings_paused", loanId: r.loan_id, data: { title: r.title } });
}

async function resumePausedBookings(tx: Tx, copyId: string) {
  await tx`update copy_bookings set paused = false where copy_id = ${copyId} and paused`;
}

async function liftSuspensionIfClear(tx: Tx, userId: string) {
  await tx`
    update users set lending_suspended_at = null
     where id = ${userId} and lending_suspended_at is not null
       and not exists (select 1 from cases c join loans l on l.id = c.loan_id
                        where l.borrower_id = ${userId} and c.closed_at is null and c.stage >= 2)`;
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
    await notify(tx, { userId: info.owner_id, type: "case_response", loanId: c.loan_id, data: { title: info.title, text: input.response === "return_date" ? "Ein Rückgabetermin ist genannt." : input.response === "object" ? "Widerspruch eingelegt, die Moderation entscheidet." : "Ein Ersatz ist angeboten." } });
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
  await liftSuspensionIfClear(tx, loan.borrower_id);
  await tx`select recompute_trust(${loan.borrower_id})`;
  const info = await loanInfo(tx, loan.id);
  const text =
    outcome === "replaced" ? "Der Ersatz ist bestätigt." : outcome === "rejected" ? "Die Moderation hat entschieden: kein Schaden." : "Das Buch ist zurück.";
  for (const uid of [loan.owner_id, loan.borrower_id]) await notify(tx, { userId: uid, type: "case_resolved", loanId: loan.id, data: { title: info.title, text } });
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
    await notify(tx, { userId: l2.borrower_id, type: "cancelled", loanId: f.id, data: { title: info2.title, name: "Das System" } });
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
    const current = await getLoan(tx, loanId);
    if (!current?.swap_offer_copy_id) throw err.conflict("no_offer", "Es liegt kein Tauschangebot vor.");
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

// ---------------------------------------------------------------------------
// Übergabe-Chats schreibschützen: 7 Tage nach dem Wechsel (4.10)
// ---------------------------------------------------------------------------

async function closeHandoverChatsFor(tx: Tx, startedLoanId: string) {
  await tx`update handover_chats set read_only_at = now() + interval '7 days'
            where next_loan_id = ${startedLoanId} and read_only_at is null`;
}

export { SYSTEM };
