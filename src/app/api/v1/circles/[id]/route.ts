import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { circleFor, circleMembers, renewInvite, setMember, updateCircle } from "@/lib/circles";
import { sql } from "@/lib/db";

/** GET /api/v1/circles/:id – Kreis mit Mitgliedern und gemeinsamem Regal */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await requireUser();
  const circle = await circleFor(p.id, u.id);
  const members = await circleMembers(p.id);
  const copies = await sql`
    select c.id, w.title, w.authors, o.first_name as owner_name, c.owner_id,
           (select key from copy_photos ph where ph.copy_id = c.id order by position limit 1) as photo_key
      from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null
      join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
     where cc.circle_id = ${p.id} order by c.created_at desc`;
  return { circle: circle.my_role === "admin" ? circle : { ...circle, invite_code: circle.join_mode === "link" ? circle.invite_code : null }, members, copies };
});

export const PATCH = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.object({
      name: z.string().min(2).max(60).optional(),
      description: z.string().max(280).nullish(),
      loanDays: z.union([z.literal(14), z.literal(28), z.literal(42), z.literal(56)]).optional(),
      autoAccept: z.boolean().optional(),
      fixedSpot: z.string().max(80).nullish(),
      joinMode: z.enum(["link", "approval"]).optional(),
      renewInvite: z.boolean().optional(),
    }),
  );
  if (b.renewInvite) return { inviteCode: await renewInvite(u.id, p.id) };
  await updateCircle(u.id, p.id, b);
  return { ok: true };
});

/** POST /api/v1/circles/:id – Mitglied freigeben, entfernen, zum Admin machen oder selbst austreten */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ memberId: z.string().uuid(), action: z.enum(["approve", "remove", "make_admin"]) }));
  await setMember(u.id, p.id, b.memberId, b.action);
  return { ok: true };
});
