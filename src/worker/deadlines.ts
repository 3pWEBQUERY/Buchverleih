/**
 * Fristen als Daten, nicht als Timer (PRD 10.2). Der Lauf sucht abgelaufene Fristen
 * und löst den Wechsel über die Zustandsmaschine aus. Ein ausgefallener Lauf holt
 * beim nächsten Mal alles nach; jeder Schritt passiert dank deadline_marks genau einmal.
 */
import { sql, type Tx } from "@/lib/db";
import { notify, type NotificationType } from "@/lib/notify";
import { loanInfo, transition } from "@/lib/loans/core";
import { releaseFollowers } from "@/lib/loans/passon";
import { executeHandover, executeReturn, completeTx, openCaseTx, markLostTx, SYSTEM } from "@/lib/loans/service";

type Result = Record<string, number>;

async function each(rows: { id: string }[], fn: (id: string) => Promise<unknown>, label: string, out: Result) {
  for (const r of rows) {
    try {
      await fn(r.id);
      out[label] = (out[label] ?? 0) + 1;
    } catch (e) {
      // Ein Vorgang, der inzwischen weiter ist, ist kein Fehler
      if ((e as { code?: string }).code !== "stale") console.error(`[deadlines] ${label} ${r.id}:`, (e as Error).message);
    }
  }
}

/** Setzt einen Merker; true, wenn er neu ist */
async function mark(tx: Tx, loanId: string, m: string) {
  const r = await tx`insert into deadline_marks (loan_id, mark) values (${loanId}, ${m}) on conflict do nothing returning 1`;
  return r.length > 0;
}

async function remind(loanId: string, m: string, targets: ("owner" | "borrower")[], type: NotificationType, sms = false) {
  await sql.begin(async (tx) => {
    if (!(await mark(tx, loanId, m))) return;
    const info = await loanInfo(tx, loanId);
    for (const t of targets) {
      await notify(tx, {
        userId: t === "owner" ? info.owner_id : info.borrower_id,
        type,
        loanId,
        sms,
        data: { title: info.title, name: t === "owner" ? info.borrower_name : info.owner_name, due: info.due_at?.toISOString() },
      });
    }
  });
}

export async function runDeadlines(): Promise<Result> {
  const out: Result = {};

  // Anfrage: 72 h ohne Antwort → verfällt, Leiher wird informiert
  await each(
    await sql`select id from loans where status = 'requested' and respond_by < now()`,
    (id) =>
      sql.begin(async (tx) => {
        const l = await transition(tx, id, "expire_request", SYSTEM, { set: tx`closed_at = now()` });
        const info = await loanInfo(tx, id);
        await notify(tx, { userId: l.borrower_id, type: "request_expired", loanId: id, data: { title: info.title } });
      }),
    "requests_expired",
    out,
  );

  // Einseitige Übergabemeldung: Erinnerung nach 24 h, gilt nach 48 h ohne Einspruch
  for (const r of await sql<{ id: string; by_owner: boolean }[]>`
      select id, handover_reported_by = owner_id as by_owner from loans
       where status = 'accepted' and handover_reported_at < now() - interval '24 hours' and handover_reported_at > now() - interval '48 hours'`) {
    await remind(r.id, "handover_report_24h", [r.by_owner ? "borrower" : "owner"], "handover_reported");
  }
  await each(
    await sql`select id from loans where status = 'accepted' and handover_reported_at < now() - interval '48 hours'`,
    (id) =>
      sql.begin(async (tx) => {
        const [l] = await tx<{ handover_method: string }[]>`select handover_method from loans where id = ${id}`;
        await executeHandover(tx, id, "handover_report_lapse", SYSTEM, (l.handover_method as "report" | "dropoff") ?? "report");
      }),
    "handover_reports_lapsed",
    out,
  );

  // 7 Tage nach geplantem Beginn ohne Übergabe → Vorgang verfällt, Zeitraum wieder frei
  await each(
    await sql`select id from loans where status = 'accepted' and handover_by < now() and handover_reported_at is null and received_from_loan_id is null`,
    (id) =>
      sql.begin(async (tx) => {
        const l = await transition(tx, id, "expire_handover", SYSTEM, { set: tx`closed_at = now()` });
        await tx`delete from copy_bookings where loan_id = ${id}`;
        await releaseFollowers(tx, id, "expired");
        if (l.swap_copy_id) await tx`delete from copy_bookings where copy_id = ${l.swap_copy_id} and note = ${"Tausch " + id}`;
        const info = await loanInfo(tx, id);
        for (const uid of [l.owner_id, l.borrower_id]) await notify(tx, { userId: uid, type: "handover_expired", loanId: id, data: { title: info.title } });
      }),
    "handovers_expired",
    out,
  );

  // Rückgabemeldung gilt nach 48 h ohne Einspruch – schützt den Leiher
  await each(
    await sql`select id from loans where status = 'return_reported' and return_reported_at < now() - interval '48 hours'`,
    (id) => sql.begin((tx) => executeReturn(tx, id, "return_report_lapse", SYSTEM)),
    "return_reports_lapsed",
    out,
  );

  // Prüfung: ohne Schadenmeldung innert 48 h abgeschlossen
  await each(
    await sql`select id from loans where status = 'returned' and inspection_until < now()`,
    (id) => sql.begin((tx) => completeTx(tx, id, SYSTEM)),
    "completed",
    out,
  );

  // Erinnerungen und Eskalation (4.5). due_at ist der Beginn des Tages nach dem letzten Leihtag.
  const active = await sql<{ id: string; due_key: string; days_left: number; waiting: boolean; waiting_name: string | null; waiting_day: string | null; waiting_loan: string | null }[]>`
    select l.id, ((l.due_at at time zone 'Europe/Zurich')::date)::text as due_key,
           ((l.due_at at time zone 'Europe/Zurich')::date - 1) - today_ch() as days_left,
           n.id is not null as waiting, u.first_name as waiting_name, lower(b.period)::text as waiting_day, n.id as waiting_loan
      from loans l
      left join lateral (
        select nb.period, nb.loan_id from copy_bookings nb join loans nl on nl.id = nb.loan_id
         where nb.copy_id = l.copy_id and nl.status = 'accepted' and nl.id <> l.id order by lower(nb.period) limit 1
      ) b on true
      left join loans n on n.id = b.loan_id
      left join users u on u.id = n.borrower_id
     where l.status = 'active' and l.kind = 'lend'`;
  for (const a of active) {
    const overdueDays = -a.days_left; // Tage seit dem letzten Leihtag
    // Merker hängen an der Fälligkeit: nach einer Verlängerung oder einem Rückruf kommen die Erinnerungen neu.
    // Bereiche statt genauer Tage: fällt der Worker einen Tag aus, wird nachgeholt.
    const k = (m: string) => `${m}:${a.due_key}`;
    if (a.days_left >= 2 && a.days_left <= 5) await remind(a.id, k("due_5d"), ["borrower"], "due_soon");
    if (a.days_left >= 0 && a.days_left <= 1) await remind(a.id, k("due_1d"), ["borrower"], "due_tomorrow");
    if (a.days_left < 0) await remind(a.id, k("overdue"), ["borrower", "owner"], "overdue");
    // «unpünktlich» gilt ab due_at + 3 Tage (= 4. Tag nach dem letzten Leihtag), ein Fall ab due_at + 7 Tage
    if (overdueDays >= 4) await remind(a.id, k("overdue_3d"), ["borrower"], "overdue_late");
    if (overdueDays >= 8) await remind(a.id, k("overdue_7d"), ["borrower", "owner"], "overdue_case_possible");
    if (a.days_left < 0 && a.waiting) {
      await sql.begin(async (tx) => {
        if (!(await mark(tx, a.id, "someone_waiting"))) return;
        const info = await loanInfo(tx, a.id);
        await notify(tx, { userId: info.borrower_id, type: "someone_waiting", loanId: a.id, data: { title: info.title, name: a.waiting_name ?? "", day: a.waiting_day ?? undefined } });
      });
    }
  }

  // + 21 Tage: Fall wird automatisch eröffnet
  await each(
    await sql`select id from loans where status = 'active' and kind = 'lend' and due_at < now() - interval '21 days'`,
    (id) => sql.begin((tx) => openCaseTx(tx, id, SYSTEM)),
    "cases_auto_opened",
    out,
  );

  // Streitfall bei ausbleibender Rückgabe (6.3): Tag 7, 14, 30
  const cases = await sql<{ id: string; loan_id: string; stage: number; age_days: number; borrower_id: string }[]>`
    select c.id, c.loan_id, c.stage, extract(day from now() - c.opened_at)::int as age_days, l.borrower_id
      from cases c join loans l on l.id = c.loan_id
     where c.kind = 'nonreturn' and c.closed_at is null`;
  for (const c of cases) {
    try {
      if (c.age_days >= 30 && c.stage < 3) {
        await sql.begin((tx) => markLostTx(tx, c.id, SYSTEM));
        out.cases_lost = (out.cases_lost ?? 0) + 1;
      } else if (c.age_days >= 14 && c.stage < 2) {
        await sql.begin(async (tx) => {
          await tx`update cases set stage = 2 where id = ${c.id}`;
          await tx`update users set lending_suspended_at = coalesce(lending_suspended_at, now()) where id = ${c.borrower_id}`;
          const info = await loanInfo(tx, c.loan_id);
          await notify(tx, { userId: c.borrower_id, type: "case_suspended", loanId: c.loan_id, data: { title: info.title } });
        });
        out.cases_suspended = (out.cases_suspended ?? 0) + 1;
      } else if (c.age_days >= 7 && c.stage < 1) {
        await sql`update cases set stage = 1 where id = ${c.id}`;
        // Zweite Aufforderung per E-Mail und SMS
        await remind(c.loan_id, `case_${c.id}_d7`, ["borrower"], "case_reminder", true);
        out.cases_reminded = (out.cases_reminded ?? 0) + 1;
      }
    } catch (e) {
      console.error("[deadlines] case", c.id, (e as Error).message);
    }
  }

  await sql`insert into worker_heartbeats (job, last_run_at, last_result) values ('deadlines', now(), ${sql.json(out)})
            on conflict (job) do update set last_run_at = now(), last_result = excluded.last_result`;
  return out;
}

/** Tägliche Aufräumarbeiten (PRD 12: Aufbewahrung) */
export async function runRetention() {
  // Chat-Inhalte 12 Monate nach Abschluss löschen
  const msgs = await sql`
    delete from messages m using loans l
     where m.loan_id = l.id and l.closed_at < now() - interval '12 months' returning m.id`;
  await sql`delete from messages m using handover_chats hc, loans n
             where m.handover_chat_id = hc.id and n.id = hc.next_loan_id and n.closed_at < now() - interval '12 months'`;
  await sql`delete from sessions where expires_at < now()`;
  await sql`delete from login_tokens where expires_at < now() - interval '1 day'`;
  await sql`delete from webauthn_challenges where expires_at < now()`;
  await sql`delete from rate_limits where window_start < now() - interval '1 day'`;
  await sql`delete from phone_verifications where expires_at < now() - interval '7 days'`;
  await sql`delete from jobs where done_at < now() - interval '14 days'`;
  await sql`delete from notifications where channel <> 'app' and sent_at < now() - interval '90 days'`;
  // App-Benachrichtigungen: gelesene nach 12 Monaten; Suchprotokoll nach 6 Monaten; tote Jobs nach 30 Tagen
  await sql`delete from notifications where channel = 'app' and read_at < now() - interval '12 months'`;
  const searches = await sql`delete from search_log where created_at < now() - interval '6 months' returning id`;
  const dead = await sql`delete from jobs where done_at is null and attempts >= 5 and run_at < now() - interval '30 days' returning id`;
  const [stuck] = await sql<{ n: number }[]>`select count(*)::int as n from jobs where done_at is null and attempts >= 5`;
  if (stuck.n) console.warn(`[jobs] ${stuck.n} Jobs endgültig gescheitert (attempts >= 5)`);
  return { messagesDeleted: msgs.length, searchesDeleted: searches.length, deadJobsDeleted: dead.length, deadJobs: stuck.n };
}
