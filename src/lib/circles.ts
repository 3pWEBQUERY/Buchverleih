/** Kreise (PRD 7.5): geschlossene Gruppe mit gemeinsamem Regal. Beitritt per Link oder Freigabe. */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { shortCode } from "@/lib/crypto";
import { notify } from "@/lib/notify";

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
    await tx`insert into circle_members (circle_id, user_id, status) values (${c.id}, ${userId}, ${status}) on conflict do nothing`;
    if (status === "pending") {
      const admins = await tx<{ user_id: string }[]>`select user_id from circle_members where circle_id = ${c.id} and role = 'admin'`;
      const [me] = await tx<{ first_name: string }[]>`select first_name from users where id = ${userId}`;
      for (const a of admins) await notify(tx, { userId: a.user_id, type: "circle_join_request", data: { name: me.first_name, text: `Kreis «${c.name}»`, href: `/kreise/${c.id}` } });
    }
    return { circleId: c.id, status };
  });
}

async function assertAdmin(circleId: string, userId: string) {
  const [m] = await sql<{ role: string }[]>`select role from circle_members where circle_id = ${circleId} and user_id = ${userId} and status = 'active'`;
  if (m?.role !== "admin") throw err.forbidden("Nur Admins des Kreises können das ändern.");
}

export async function updateCircle(userId: string, circleId: string, input: { name?: string; description?: string | null; loanDays?: number; autoAccept?: boolean; fixedSpot?: string | null; joinMode?: "link" | "approval" }) {
  await assertAdmin(circleId, userId);
  const row: Record<string, unknown> = {};
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
    await sql`delete from circle_members where circle_id = ${circleId} and user_id = ${userId}`;
    await sql`delete from circle_copies cc using copies c where cc.circle_id = ${circleId} and c.id = cc.copy_id and c.owner_id = ${userId}`;
    return;
  }
  await assertAdmin(circleId, userId);
  if (action === "approve") await sql`update circle_members set status = 'active' where circle_id = ${circleId} and user_id = ${memberId}`;
  if (action === "make_admin") await sql`update circle_members set role = 'admin' where circle_id = ${circleId} and user_id = ${memberId}`;
  if (action === "remove") {
    await sql`delete from circle_members where circle_id = ${circleId} and user_id = ${memberId}`;
    await sql`delete from circle_copies cc using copies c where cc.circle_id = ${circleId} and c.id = cc.copy_id and c.owner_id = ${memberId}`;
  }
}

export async function circleMembers(circleId: string) {
  return sql<{ user_id: string; first_name: string; role: string; status: string; trust_level: number; municipality: string | null }[]>`
    select m.user_id, u.first_name, m.role, m.status, u.trust_level, u.municipality
      from circle_members m join users u on u.id = m.user_id
     where m.circle_id = ${circleId} order by m.status desc, m.role, u.first_name`;
}
