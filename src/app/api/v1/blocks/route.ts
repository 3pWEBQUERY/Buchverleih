import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";

/** Blockieren mit einem Tipp. Blockierte sehen das Regal nicht mehr (PRD 6.5). Rückgängig per DELETE. */
export const GET = route(async () => {
  const u = await requireUser();
  return { blocks: await sql`select b.blocked_id, u.first_name, b.created_at from blocks b join users u on u.id = b.blocked_id where b.blocker_id = ${u.id}` };
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ userId: z.string().uuid() }));
  await sql`insert into blocks (blocker_id, blocked_id) values (${u.id}, ${b.userId}) on conflict do nothing`;
  return { ok: true, undo: true };
});

export const DELETE = route(async (req) => {
  const u = await requireUser();
  await sql`delete from blocks where blocker_id = ${u.id} and blocked_id = ${new URL(req.url).searchParams.get("user")}`;
  return { ok: true };
});
