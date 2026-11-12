/**
 * Interne Werkzeuge (PRD 6.5, 7.8): Fälle, Meldungen, Kontosperren, Verlauf eines Vorgangs,
 * Kennzahlen, Katalogpflege, Feature-Schalter pro Region.
 * Zugriff auf Chat-Inhalte nur bei Meldung oder offenem Fall, mit Protokoll (PRD 12).
 */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { markLostTx, resolveCaseTx } from "@/lib/loans/service";

async function log(modId: string, action: string, targetType: string, targetId: string, note?: string | null) {
  await sql`insert into moderation_log (moderator_id, action, target_type, target_id, note)
            values (${modId}, ${action}, ${targetType}, ${targetId}, ${note ?? null})`;
}

export async function queue() {
  const cases = await sql<{ id: string; loan_id: string; kind: string; stage: number; opened_at: Date; response: string | null; title: string; owner: string; borrower: string; needs_decision: boolean }[]>`
    select c.id, c.loan_id, c.kind, c.stage, c.opened_at, c.response, e.title, o.first_name as owner, b.first_name as borrower,
           (c.response = 'object' or c.stage >= 2) as needs_decision
      from cases c join loans l on l.id = c.loan_id
      join copies cp on cp.id = l.copy_id join editions e on e.id = cp.edition_id
      join users o on o.id = l.owner_id join users b on b.id = l.borrower_id
     where c.closed_at is null
     order by (c.response = 'object' or c.stage >= 2) desc, c.opened_at`;
  const reports = await sql<{ id: string; target_type: string; target_id: string; reason: string; note: string | null; created_at: Date; reporter: string | null }[]>`
    select r.id, r.target_type, r.target_id, r.reason, r.note, r.created_at, u.first_name as reporter
      from reports r left join users u on u.id = r.reporter_id
     where r.status = 'open' order by r.created_at`;
  const corrections = await sql<{ id: string; edition_id: string; field: string; suggestion: string; title: string; created_at: Date }[]>`
    select cc.id, cc.edition_id, cc.field, cc.suggestion, e.title, cc.created_at
      from catalog_corrections cc join editions e on e.id = cc.edition_id where cc.status = 'open' order by cc.created_at`;
  return { cases, reports, corrections };
}

/** Verlauf eines Vorgangs. Chat nur bei offenem Fall oder Meldung – und protokolliert. */
export async function loanDossier(mod: SessionUser, loanId: string) {
  const [loan] = await sql`
    select l.*, e.title, o.first_name as owner_name, o.email as owner_email, b.first_name as borrower_name, b.email as borrower_email
      from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id
      join users o on o.id = l.owner_id join users b on b.id = l.borrower_id where l.id = ${loanId}`;
  if (!loan) throw err.notFound();
  const events = await sql`select ev.*, u.first_name as actor_name from loan_events ev left join users u on u.id = ev.actor_id
                           where ev.loan_id = ${loanId} order by ev.id`;
  const cases = await sql`select * from cases where loan_id = ${loanId} order by opened_at`;
  const [reason] = await sql<{ n: number }[]>`
    select (select count(*) from cases where loan_id = ${loanId} and closed_at is null)
         + (select count(*) from reports where status = 'open' and ((target_type = 'loan' and target_id = ${loanId})
              or (target_type = 'message' and target_id in (select id::text from messages where loan_id = ${loanId})))) as n`;
  let messages: readonly unknown[] = [];
  if (Number(reason.n) > 0) {
    messages = await sql`select m.id, u.first_name as sender, m.body, m.proposal_place, m.proposal_at, m.flagged, m.created_at
                         from messages m left join users u on u.id = m.sender_id where m.loan_id = ${loanId} order by m.created_at`;
    // Protokoll: höchstens ein Eintrag pro Stunde, Person und Vorgang
    const [recent] = await sql<{ n: number }[]>`
      select count(*)::int as n from moderation_log where moderator_id = ${mod.id} and action = 'read_chat'
         and target_id = ${loanId} and created_at > now() - interval '1 hour'`;
    if (!recent.n) await log(mod.id, "read_chat", "loan", loanId, "Zugriff bei offenem Fall oder Meldung");
  }
  return { loan, events, cases, messages, chatAccess: Number(reason.n) > 0 };
}

export async function decideCase(mod: SessionUser, caseId: string, decision: "returned" | "replaced" | "rejected" | "lost", note?: string) {
  await sql.begin(async (tx) => {
    if (decision === "lost") await markLostTx(tx, caseId, { role: "moderator", id: mod.id });
    else await resolveCaseTx(tx, caseId, { role: "moderator", id: mod.id }, decision, note);
  });
  await log(mod.id, `case_${decision}`, "case", caseId, note);
}

export async function handleReport(mod: SessionUser, reportId: string, status: "actioned" | "dismissed", note?: string) {
  await sql`update reports set status = ${status}, handled_by = ${mod.id}, handled_at = now() where id = ${reportId}`;
  await log(mod.id, `report_${status}`, "report", reportId, note);
}

const RANK: Record<string, number> = { member: 0, moderator: 1, admin: 2 };

/** Eingriffe nur gegenüber Personen mit niedrigerer Rolle; sich selbst nie */
async function assertOutranks(mod: SessionUser, userId: string) {
  if (userId === mod.id) throw err.forbidden("Das geht nicht beim eigenen Konto.");
  const [t] = await sql<{ role: string }[]>`select role from users where id = ${userId}`;
  if (!t) throw err.notFound();
  if ((RANK[t.role] ?? 0) >= (RANK[mod.role] ?? 0)) throw err.forbidden("Personen mit gleicher oder höherer Rolle kannst du nicht moderieren.");
}

export async function setBan(mod: SessionUser, userId: string, banned: boolean, reason?: string) {
  await assertOutranks(mod, userId);
  if (banned) {
    await sql`update users set banned_at = now(), ban_reason = ${reason ?? null} where id = ${userId}`;
    await sql`delete from sessions where user_id = ${userId}`;
    await sql`insert into banned_phones (phone_e164, reason) select phone_e164, ${"Sperre: " + (reason ?? "")}
              from users where id = ${userId} and phone_e164 is not null on conflict do nothing`;
  } else {
    await sql`update users set banned_at = null, ban_reason = null where id = ${userId}`;
    await sql`delete from banned_phones where phone_e164 = (select phone_e164 from users where id = ${userId}) and reason like 'Sperre:%'`;
  }
  await log(mod.id, banned ? "ban" : "unban", "user", userId, reason);
}

/**
 * Rolle ändern: Nur Admins ernennen oder entziehen die Moderation. Admins selbst
 * werden hier nicht verändert (Schutz vor Aussperren), das eigene Konto nie.
 */
export async function setRole(mod: SessionUser, userId: string, role: "member" | "moderator") {
  if (mod.role !== "admin") throw err.forbidden("Rollen vergeben nur Admins.");
  if (userId === mod.id) throw err.forbidden("Die eigene Rolle kannst du nicht ändern.");
  const [t] = await sql<{ role: string; banned_at: Date | null; deleted_at: Date | null }[]>`select role, banned_at, deleted_at from users where id = ${userId}`;
  if (!t || t.deleted_at) throw err.notFound();
  if (t.role === "admin") throw err.forbidden("Admins lassen sich hier nicht ändern.");
  if (role === "moderator" && t.banned_at) throw err.conflict("banned", "Gesperrte Konten können nicht moderieren.");
  if (t.role === role) return;
  await sql`update users set role = ${role} where id = ${userId}`;
  // Neue Rechte gelten sofort: bestehende Sitzungen behalten sie über getUser ohnehin
  await log(mod.id, role === "moderator" ? "role_moderator" : "role_member", "user", userId);
}

/**
 * Admins: Einmal-Passwort für ein Konto erzeugen (z. B. Konten aus der Zeit vor der Passwort-Anmeldung,
 * solange kein Mailversand läuft). Wird nur einmal angezeigt und protokolliert; die Person ändert es danach.
 */
export async function temporaryPassword(mod: SessionUser, userId: string) {
  if (mod.role !== "admin") throw err.forbidden("Einmal-Passwörter vergeben nur Admins.");
  const [t] = await sql<{ deleted_at: Date | null }[]>`select deleted_at from users where id = ${userId}`;
  if (!t || t.deleted_at) throw err.notFound();
  const { shortCode } = await import("@/lib/crypto");
  const { setPassword } = await import("@/lib/auth/flows");
  const password = `${shortCode(4)}-${shortCode(4)}-${shortCode(4)}`;
  await setPassword(userId, password);
  await log(mod.id, "temp_password", "user", userId);
  return password;
}

export async function setSuspension(mod: SessionUser, userId: string, suspended: boolean) {
  await assertOutranks(mod, userId);
  await sql`update users set lending_suspended_at = ${suspended ? sql`now()` : null} where id = ${userId}`;
  await log(mod.id, suspended ? "suspend" : "unsuspend", "user", userId);
}

/** Unpassendes Profilbild entfernen (Regeln: Fotos). Die Dateien werden aus dem Bucket gelöscht. */
export async function removeAvatar(mod: SessionUser, userId: string, note?: string) {
  await assertOutranks(mod, userId);
  const { setAvatar } = await import("@/lib/account");
  await setAvatar(userId, null);
  await log(mod.id, "avatar_removed", "user", userId, note);
}

export async function userDossier(userId: string) {
  const [u] = await sql`select u.id, u.first_name, u.avatar_key, u.email, u.phone_e164, u.municipality, u.trust_level, u.role, u.created_at,
                               u.banned_at, u.ban_reason, u.lending_suspended_at, s.*
                          from users u join user_stats s on s.user_id = u.id where u.id = ${userId}`;
  if (!u) throw err.notFound();
  const loans = await sql`select l.id, l.kind, l.status, l.requested_at, e.title, l.owner_id = ${userId} as as_owner
                            from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id
                           where l.owner_id = ${userId} or l.borrower_id = ${userId} order by l.requested_at desc limit 50`;
  const reports = await sql`select * from reports where target_type = 'user' and target_id = ${userId} order by created_at desc`;
  return { user: u, loans, reports };
}

/** Moderationsteam: alle Admins und Moderatoren */
export async function team() {
  return sql<{ id: string; first_name: string; avatar_key: string | null; email: string; role: string }[]>`
    select id, first_name, avatar_key, email, role::text as role from users
     where role <> 'member' and deleted_at is null order by role desc, first_name`;
}

export async function findUsers(q: string) {
  const s = `%${q.trim().toLowerCase()}%`;
  return sql<{ id: string; first_name: string; avatar_key: string | null; email: string; municipality: string | null; banned_at: Date | null; role: string }[]>`
    select id, first_name, avatar_key, email, municipality, banned_at, role::text as role from users
     where deleted_at is null and (lower(email) like ${s} or lower(first_name) like ${s}) order by created_at desc limit 20`;
}

export async function applyCorrection(mod: SessionUser, id: string, apply: boolean) {
  await sql.begin(async (tx) => {
    const [c] = await tx<{ edition_id: string; field: string; suggestion: string }[]>`
      select edition_id, field, suggestion from catalog_corrections where id = ${id} and status = 'open' for update`;
    if (!c) throw err.notFound();
    if (apply) {
      const map: Record<string, ReturnType<typeof tx>> = {
        title: tx`update works set title = ${c.suggestion} where id = (select work_id from editions where id = ${c.edition_id})`,
        authors: tx`update works set authors = ${c.suggestion.split(",").map((s) => s.trim())}::text[] where id = (select work_id from editions where id = ${c.edition_id})`,
        publisher: tx`update editions set publisher = ${c.suggestion} where id = ${c.edition_id}`,
        year: tx`update editions set year = ${Number(c.suggestion) || null} where id = ${c.edition_id}`,
        language: tx`update editions set language = ${c.suggestion} where id = ${c.edition_id}`,
        genre: tx`update works set genre = ${c.suggestion} where id = (select work_id from editions where id = ${c.edition_id})`,
      };
      const q = map[c.field];
      if (q) await q;
    }
    await tx`update catalog_corrections set status = ${apply ? "applied" : "rejected"}, handled_by = ${mod.id} where id = ${id}`;
  });
  await log(mod.id, apply ? "correction_applied" : "correction_rejected", "correction", id);
}

export async function flags() {
  return sql<{ key: string; region_id: string; region_name: string; enabled: boolean; region_enabled: boolean }[]>`
    select f.key, f.region_id, r.name as region_name, f.enabled, r.enabled as region_enabled
      from feature_flags f join regions r on r.id = f.region_id order by r.name, f.key`;
}

export async function setFlag(mod: SessionUser, key: string, regionId: string, enabled: boolean) {
  // Regionen und Funktionen schalten nur Admins
  if (mod.role !== "admin") throw err.forbidden("Regionen und Funktionen schalten nur Admins.");
  if (key === "__region") await sql`update regions set enabled = ${enabled} where id = ${regionId}`;
  else await sql`update feature_flags set enabled = ${enabled}, updated_at = now() where key = ${key} and region_id = ${regionId}`;
  await log(mod.id, `flag_${enabled ? "on" : "off"}`, "flag", `${regionId}:${key}`);
}

/** Kennzahlen aus PRD Abschnitt 2 */
export async function kpis() {
  const [k] = await sql`
    with lend as (select * from loans where kind = 'lend'),
         answered as (select l.id, l.requested_at, min(e.created_at) as answered_at, bool_or(e.action in ('accept', 'auto_accept')) as accepted
                        from lend l join loan_events e on e.loan_id = l.id and e.action in ('accept', 'auto_accept', 'decline', 'expire_request')
                       group by l.id, l.requested_at)
    select
      (select count(*) from lend where status = 'completed' and closed_at > now() - interval '7 days')::int as completed_week,
      (select round(100.0 * count(*) filter (where accepted) / nullif(count(*), 0), 1) from answered) as acceptance_rate,
      (select round(extract(epoch from percentile_cont(0.5) within group (order by answered_at - requested_at)) / 3600, 1)
         from answered where answered_at is not null) as median_response_hours,
      (select round(100.0 * count(*) filter (where not late) / nullif(count(*), 0), 1) from lend where returned_at is not null) as on_time_rate,
      (select round(100.0 * (select count(distinct loan_id) from cases) / nullif(count(*), 0), 2) from lend where handed_over_at is not null) as dispute_rate,
      (select round(100.0 * count(*) filter (where status = 'lost') / nullif(count(*), 0), 2) from lend where handed_over_at is not null) as loss_rate,
      (select percentile_cont(0.5) within group (order by n) from (
          select count(c.id) as n from users u left join copies c on c.owner_id = u.id and c.removed_at is null
           where u.onboarded_at is not null and u.deleted_at is null group by u.id) t) as shelf_depth,
      (select round(100.0 * count(*) filter (where available_5km > 0) / nullif(count(*), 0), 1) from search_log where created_at > now() - interval '30 days') as liquidity,
      (select round(100.0 * count(*) filter (where second_at is not null and second_at <= first_at + interval '60 days') / nullif(count(*), 0), 1)
         from (select borrower_id, min(requested_at) as first_at,
                      (array_agg(requested_at order by requested_at))[2] as second_at
                 from lend where handed_over_at is not null group by borrower_id) t) as return_rate,
      (select count(*) from users where onboarded_at is not null and deleted_at is null)::int as members,
      (select count(*) from copies where removed_at is null)::int as copies,
      (select count(*) from circles)::int as circles,
      (select round(100.0 * count(*) filter (where circle_id is not null) / nullif(count(*), 0), 1) from lend) as circle_share,
      (select count(*) from interest_signals where key = 'shipping')::int as shipping_interest,
      (select last_run_at from worker_heartbeats where job = 'deadlines') as deadlines_last_run`;
  return k;
}

export async function moderationLog(limit = 100) {
  return sql`select m.*, u.first_name as moderator from moderation_log m join users u on u.id = m.moderator_id order by m.id desc limit ${limit}`;
}
