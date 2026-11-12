/**
 * Vorgänge: Übergabe, Verlängerung, Rückruf, Rückgabe, Abschluss.
 * Teil von ./service.ts (dort öffentlich exportiert).
 */
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { addDays, diffDays, parseRange, todayCH } from "@/lib/dates";
import { getLoan, loanFor, loanInfo, transition, type ActorRef, type LoanRow } from "./core";
import { releaseFollowers } from "./passon";
import { SYSTEM, tryMoveBooking, transferOwnership, assertOwnPhotos, offerEarlierStart, resumePausedBookings, liftSuspensionIfClear, closeHandoverChatsFor } from "./service-shared";
import type { TxSql } from "./service-shared";
import type postgres from "postgres";

type Fragment = postgres.PendingQuery<postgres.Row[]>;

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
  /** Zusatzbedingung für den Wechsel, z. B. die Frist beim Fristablauf (atomar geprüft) */
  where?: Fragment,
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
        const start = today < range.start ? range.start : today;
        const startOnly = start < range.end! && (await tryMoveBooking(tx, loanId, start, range.end!));
        if (!startOnly && today < range.start)
          throw err.conflict("too_early", "Das Buch ist bis zum geplanten Beginn noch gebucht.");
        // Der gebuchte Zeitraum ist schon vorbei und danach ist das Buch vergeben: keine Leihfrist mehr möglich
        if (!startOnly && today >= range.end!)
          throw err.conflict("period_over", "Der gebuchte Zeitraum ist vorbei und das Buch ist danach schon gebucht. Storniere den Vorgang und frag für einen neuen Zeitraum an.");
        newEnd = range.end!;
      }
    }

    const loan = await transition(tx, loanId, action, actor, {
      where,
      set: tx`handed_over_at = ${handedAt},
              handover_method = ${method},
              due_at = (select day_start_ch(upper(period)) from copy_bookings where loan_id = ${loanId}),
              wanted = (select period from copy_bookings where loan_id = ${loanId}),
              condition_note_until = greatest(${handedAt}::timestamptz + interval '24 hours', now() + interval '24 hours')`,
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
    where,
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
      await assertOwnPhotos(tx, user.id, loanId, [input.dropoffPhotoKey], "dropoff");
      action = "dropoff";
    }
    // Gleiches Fenster wie bei der Übergabe selbst: frühestens 3 Tage vor dem Beginn
    const start = parseRange(current.wanted)?.start;
    if (current.kind === "lend" && start && diffDays(todayCH(), start) > 3)
      throw err.conflict("too_early", "Die Übergabe ist frühestens 3 Tage vor dem geplanten Beginn möglich.");
    const loan = await transition(tx, loanId, action, { role: role!, id: user.id }, {
      set: tx`handover_reported_at = now(), handover_reported_by = ${user.id},
              handover_method = ${action === "dropoff" ? "dropoff" : "report"},
              dropoff_photo_key = ${input.dropoffPhotoKey ?? null}`,
      where: tx`l.handover_reported_at is null`,
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
    // Ein Einspruch dazwischen gewinnt: die Meldung muss beim Wechsel noch stehen
    return executeHandover(tx, loanId, "confirm_handover", { role: role!, id: user.id }, (loan.handover_method as "report" | "dropoff") ?? "report",
      tx`l.handover_reported_at is not null and l.handover_reported_by <> ${user.id}`);
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
  return sql.begin(async (tx) => {
    const photos = await assertOwnPhotos(tx, user.id, loanId, input.photoKeys, "condition");
    return transition(tx, loanId, "condition_note", { role: "borrower", id: user.id }, {
      set: tx`condition_note = ${input.note.trim() || null}, condition_photo_keys = ${photos}::text[]`,
      where: tx`l.condition_note_until > now()`,
    });
  });
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
    const { loan: unlocked } = await loanFor(tx, loanId, user.id);
    // Sperren vor der Buchung (gleiche Reihenfolge wie Rückruf und Rückgabe: erst Vorgang, dann Buchung)
    const loan = (await getLoan(tx, unlocked.id, true))!;
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
    const { loan: unlocked } = await loanFor(tx, loanId, user.id);
    const loan = (await getLoan(tx, unlocked.id, true))!;
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
  const start = parseRange(loan.wanted)?.start;
  // Gleichzeitig angenommene Buchung danach: freundliche Meldung statt Serverfehler
  if (!start || !(await tryMoveBooking(tx, loan.id, (await bookingStart(tx, loan.id)) ?? start, end)))
    throw err.conflict("calendar_next", "Direkt danach ist das Buch gebucht. Eine Verlängerung ist nicht möglich.");
  const l = await transition(tx, loan.id, action, actor, {
    set: tx`due_at = day_start_ch(${end}::date), extensions_used = l.extensions_used + 1, extension_requested_at = null,
            wanted = daterange(lower(l.wanted), ${end}::date)`,
    where: tx`l.extensions_used = ${loan.extensions_used} and l.recalled_at is null`,
    meta: { until: end },
  });
  const info = await loanInfo(tx, loan.id);
  await notify(tx, { userId: l.borrower_id, type: "extended", loanId: l.id, data: { title: info.title, due: l.due_at?.toISOString() } });
  return l;
}

async function bookingStart(tx: Tx, loanId: string) {
  const [b] = await tx<{ start: string }[]>`select lower(period)::text as start from copy_bookings where loan_id = ${loanId}`;
  return b?.start ?? null;
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
  /** Zusatzbedingung, z. B. die Einspruchsfrist beim Fristablauf */
  extra?: Fragment,
) {
  const current = await getLoan(tx, loanId, true);
  if (!current) throw err.notFound();
  const returnedAt = action === "return_report_lapse" && current.return_reported_at ? current.return_reported_at : new Date();
  const [openCase] = await tx<{ n: number }[]>`
    select count(*)::int as n from cases where loan_id = ${loanId} and kind = 'nonreturn' and closed_at is null`;
  const hadCase = openCase.n > 0;

  const loan = await transition(tx, loanId, action, actor, {
    set: tx`returned_at = ${returnedAt},
            inspection_until = ${returnedAt}::timestamptz + interval '48 hours', -- bei gemeldeter Rückgabe zählt die Einspruchsfrist als Prüfung (PRD)
            late = (${returnedAt}::timestamptz > l.due_at + interval '3 days')`,
    // Aus «Fall offen» nur bei ausbleibender Rückgabe, nicht bei einem Schadenfall
    where: extra ? tx`(l.status <> 'disputed' or ${hadCase}) and ${extra}` : tx`(l.status <> 'disputed' or ${hadCase})`,
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

export async function completeTx(tx: TxSql, loanId: string, actor: ActorRef, where?: Fragment) {
  const loan = await transition(tx, loanId, "complete", actor, {
    set: tx`closed_at = now(), rating_closes_at = now() + interval '14 days'`,
    where,
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
