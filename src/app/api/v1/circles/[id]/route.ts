import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { circleFor, circleMembers, renewInvite, setMember, updateCircle } from "@/lib/circles";
import { sql } from "@/lib/db";
import { circleOverview } from "@/lib/circle-overview";

/**
 * GET /api/v1/circles/:id – Kreis mit Mitgliedern und gemeinsamem Regal.
 * `overview` («Auf einen Blick»): new (neueste Bücher, 14 Tage), wanted (gesuchte Titel, die ein Mitglied hat),
 * handovers (eigene Übergaben/Rückgaben mit Kreismitgliedern in den nächsten 7 Tagen).
 */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await requireUser();
  const circle = await circleFor(p.id, u.id);
  const members = await circleMembers(p.id, u.id);
  const copies = await sql`
    select c.id, w.title, w.authors, o.first_name as owner_name, c.owner_id, ph.key as photo_key, ph.color as photo_color,
           e.cover_key, e.cover_color
      from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null
      left join lateral (select key, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
      join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
     where cc.circle_id = ${p.id} and o.banned_at is null
       and not exists (select 1 from blocks bl where (bl.blocker_id = c.owner_id and bl.blocked_id = ${u.id}) or (bl.blocker_id = ${u.id} and bl.blocked_id = c.owner_id))
     order by c.created_at desc`;
  const overview = await circleOverview(p.id, u.id);
  return { circle: circle.my_role === "admin" ? circle : { ...circle, invite_code: circle.join_mode === "link" ? circle.invite_code : null }, members, copies, overview };
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
      /** Organisationen: Farbe aus der Kreispalette und Logo (Upload mit Zweck «avatar»); null entfernt */
      brandColor: z.string().regex(/^#[0-9a-f]{6}$/).nullable().optional(),
      logoUploadId: z.string().uuid().nullable().optional(),
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
