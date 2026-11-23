/** Kreise (PRD 7.5): geschlossene Gruppe mit gemeinsamem Regal. Beitritt per Link oder Freigabe. */
import { systemText } from "@/lib/notify/system-texts";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { shortCode } from "@/lib/crypto";
import { notify } from "@/lib/notify";
import { removeMemberContent } from "@/lib/pinboard";
import { BRAND_COLORS } from "@/lib/monogram-colors";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  loan_days: number;
  auto_accept: boolean;
  fixed_spot: string | null;
  join_mode: "link" | "approval";
  invite_code: string;
  created_at: Date;
  member_count: number;
  copy_count: number;
  my_role: "admin" | "member" | null;
  my_status: "pending" | "active" | null;
  plan_id: string;
  brand_color: string | null;
  logo_key: string | null;
};

export async function createCircle(userId: string, input: { name: string; description?: string | null; loanDays?: number; autoAccept?: boolean; fixedSpot?: string | null; joinMode?: "link" | "approval" }) {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      insert into circles (name, description, loan_days, auto_accept, fixed_spot, join_mode, invite_code, created_by)
      values (${input.name.trim()}, ${input.description?.trim() || null}, ${input.loanDays ?? 28}, ${input.autoAccept ?? false},
              ${input.fixedSpot?.trim() || null}, ${input.joinMode ?? "link"}, ${shortCode(10)}, ${userId})
      returning id`;
    await tx`insert into circle_members (circle_id, user_id, role) values (${c.id}, ${userId}, 'admin')`;
    return c.id;
  });
}

export async function myCircles(userId: string) {
  return sql<Circle[]>`
    select c.*, m.role as my_role, m.status as my_status,
           (select count(*)::int from circle_members x where x.circle_id = c.id and x.status = 'active') as member_count,
           (select count(*)::int from circle_copies cc join copies cp on cp.id = cc.copy_id and cp.removed_at is null where cc.circle_id = c.id) as copy_count
      from circles c join circle_members m on m.circle_id = c.id and m.user_id = ${userId}
     order by c.name`;
}

export async function circleFor(circleId: string, userId: string) {
  const [c] = await sql<Circle[]>`
    select c.*, m.role as my_role, m.status as my_status,
           (select count(*)::int from circle_members x where x.circle_id = c.id and x.status = 'active') as member_count,
           (select count(*)::int from circle_copies cc join copies cp on cp.id = cc.copy_id and cp.removed_at is null where cc.circle_id = c.id) as copy_count
      from circles c left join circle_members m on m.circle_id = c.id and m.user_id = ${userId}
     where c.id = ${circleId}`;
  if (!c || c.my_status !== "active") throw err.notFound("Diesen Kreis gibt es nicht, oder du bist kein Mitglied.");
  return c;
}

export async function circleByInvite(code: string) {
  const [c] = await sql<{ id: string; name: string; description: string | null; join_mode: "link" | "approval"; member_count: number }[]>`
    select c.id, c.name, c.description, c.join_mode,
           (select count(*)::int from circle_members x where x.circle_id = c.id and x.status = 'active') as member_count
      from circles c where c.invite_code = ${code}`;
  return c ?? null;
}

export async function joinCircle(userId: string, code: string) {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; join_mode: string; name: string }[]>`select id, join_mode, name from circles where invite_code = ${code}`;
    if (!c) throw err.notFound("Dieser Einladungslink ist ungültig oder wurde erneuert.");
    const status = c.join_mode === "approval" ? "pending" : "active";
    const inserted = await tx`insert into circle_members (circle_id, user_id, status) values (${c.id}, ${userId}, ${status})
                              on conflict do nothing returning 1`;
    // Admins nur bei einer neuen Anfrage benachrichtigen, nicht bei jeder Wiederholung
    if (status === "pending" && inserted.length > 0) {
      const admins = await tx<{ user_id: string }[]>`select user_id from circle_members where circle_id = ${c.id} and role = 'admin'`;
      const [me] = await tx<{ first_name: string }[]>`select first_name from users where id = ${userId}`;
      for (const a of admins) await notify(tx, { userId: a.user_id, type: "circle_join_request", data: { name: me.first_name, ...systemText("circle_name", { name: c.name }), href: `/kreise/${c.id}` } });
    }
    return { circleId: c.id, status };
  });
}

async function assertAdmin(circleId: string, userId: string) {
  const [m] = await sql<{ role: string }[]>`select role from circle_members where circle_id = ${circleId} and user_id = ${userId} and status = 'active'`;
  if (m?.role !== "admin") throw err.forbidden("Nur Admins des Kreises können das ändern.");
}

export async function updateCircle(userId: string, circleId: string, input: { name?: string; description?: string | null; loanDays?: number; autoAccept?: boolean; fixedSpot?: string | null; joinMode?: "link" | "approval"; brandColor?: string | null; logoUploadId?: string | null }) {
  await assertAdmin(circleId, userId);
  const row: Record<string, unknown> = {};
  // Eigenes Erscheinungsbild nur für Kreise von Organisationen (PRD 11.2); entfernen geht immer
  if (input.brandColor || input.logoUploadId) {
    const [c] = await sql<{ plan_id: string }[]>`select plan_id from circles where id = ${circleId}`;
    if (c?.plan_id !== "organization") throw err.forbidden("Farbe und Logo gibt es für Kreise von Organisationen.");
  }
  if (input.brandColor !== undefined) {
    if (input.brandColor && !BRAND_COLORS.includes(input.brandColor)) throw err.invalid("Diese Farbe gibt es nicht.");
    row.brand_color = input.brandColor;
  }
  if (input.logoUploadId !== undefined) {
    if (input.logoUploadId === null) row.logo_key = null;
    else {
      const [up] = await sql<{ key: string | null; status: string }[]>`
        select key, status from uploads where id = ${input.logoUploadId} and user_id = ${userId} and purpose = 'avatar'`;
      if (!up?.key || up.status === "pending" || up.status === "rejected") throw err.invalid("Dieses Bild können wir nicht verwenden. Lade es erneut hoch.");
      row.logo_key = up.key;
    }
  }
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.description !== undefined) row.description = input.description?.trim() || null;
  if (input.loanDays !== undefined) row.loan_days = input.loanDays;
  if (input.autoAccept !== undefined) row.auto_accept = input.autoAccept;
  if (input.fixedSpot !== undefined) row.fixed_spot = input.fixedSpot?.trim() || null;
  if (input.joinMode !== undefined) row.join_mode = input.joinMode;
  if (Object.keys(row).length) await sql`update circles set ${sql(row)} where id = ${circleId}`;
}

export async function renewInvite(userId: string, circleId: string) {
  await assertAdmin(circleId, userId);
  const [c] = await sql<{ invite_code: string }[]>`update circles set invite_code = ${shortCode(10)} where id = ${circleId} returning invite_code`;
  return c.invite_code;
}

export async function setMember(userId: string, circleId: string, memberId: string, action: "approve" | "remove" | "make_admin") {
  if (action === "remove" && memberId === userId) {
    const [a] = await sql<{ admins: number; me: string | null }[]>`
      select count(*) filter (where role = 'admin' and status = 'active')::int as admins,
             max(role) filter (where user_id = ${userId}) as me
        from circle_members where circle_id = ${circleId}`;
    if (a.me === "admin" && a.admins <= 1) {
      const [m] = await sql<{ n: number }[]>`select count(*)::int as n from circle_members where circle_id = ${circleId} and status = 'active'`;
      if (m.n > 1) throw err.conflict("last_admin", "Du bist die einzige Admin-Person. Mach zuerst jemand anderen zum Admin, dann kannst du austreten.");
    }
    await handOverLibrary(circleId, userId);
    await sql`delete from circle_members where circle_id = ${circleId} and user_id = ${userId}`;
    await sql`delete from circle_copies cc using copies c where cc.circle_id = ${circleId} and c.id = cc.copy_id and c.owner_id = ${userId}`;
    await removeMemberContent(sql, circleId, userId);
    return;
  }
  await assertAdmin(circleId, userId);
  if (action === "approve") await sql`update circle_members set status = 'active' where circle_id = ${circleId} and user_id = ${memberId}`;
  if (action === "make_admin") await sql`update circle_members set role = 'admin' where circle_id = ${circleId} and user_id = ${memberId}`;
  if (action === "remove") {
    await handOverLibrary(circleId, memberId);
    await sql`delete from circle_members where circle_id = ${circleId} and user_id = ${memberId}`;
    await sql`delete from circle_copies cc using copies c where cc.circle_id = ${circleId} and c.id = cc.copy_id and c.owner_id = ${memberId}`;
    await removeMemberContent(sql, circleId, memberId);
  }
}

/**
 * Kreisbibliothek: Wer austritt oder entfernt wird, gibt die Betreuung der Kreisbücher an die
 * dienstälteste andere Admin-Person ab. Gibt es keine mehr, gehen die Bücher an die Person zurück.
 * Laufende Leihen bleiben bei der bisherigen Betreuung, bis sie abgeschlossen sind.
 */
async function handOverLibrary(circleId: string, fromUser: string) {
  const [next] = await sql<{ user_id: string }[]>`
    select user_id from circle_members
     where circle_id = ${circleId} and role = 'admin' and status = 'active' and user_id <> ${fromUser}
     order by joined_at limit 1`;
  if (next) await sql`update copies set owner_id = ${next.user_id} where library_circle_id = ${circleId} and owner_id = ${fromUser} and removed_at is null`;
  else await sql`update copies set library_circle_id = null where library_circle_id = ${circleId} and owner_id = ${fromUser}`;
}

/** Admins übernehmen die Betreuung eines Kreisbuchs (z. B. bei Ferien). Nicht während einer laufenden Leihe. */
export async function takeOverLibraryCopy(userId: string, circleId: string, copyId: string) {
  await assertAdmin(circleId, userId);
  const r = await sql`
    update copies c set owner_id = ${userId}
     where c.id = ${copyId} and c.library_circle_id = ${circleId} and c.removed_at is null
       and not exists (select 1 from loans l where l.copy_id = c.id and l.status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed'))
     returning c.id`;
  if (!r.length) throw err.conflict("library_busy", "Das geht erst, wenn keine Anfrage und keine Leihe zu diesem Buch läuft.");
}

export async function circleMembers(circleId: string) {
  return sql<{ user_id: string; first_name: string; avatar_key: string | null; role: string; status: string; trust_level: number; municipality: string | null; joined_at: string; books: number }[]>`
    select m.user_id, u.first_name, u.avatar_key, m.role, m.status, u.trust_level, u.municipality,
           to_json(m.joined_at) #>> '{}' as joined_at,
           (select count(*)::int from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null
             where cc.circle_id = m.circle_id and c.owner_id = m.user_id) as books
      from circle_members m join users u on u.id = m.user_id
     where m.circle_id = ${circleId} order by m.status desc, m.role, u.first_name`;
}
