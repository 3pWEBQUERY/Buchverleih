import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { err } from "@/lib/errors";

/** POST /api/v1/reports – Melden mit einem Tipp (PRD 6.5) */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`report:${u.id}`, 20, 3600);
  const b = await body(
    req,
    z.object({
      targetType: z.enum(["user", "message", "copy", "photo", "edition", "loan"]),
      targetId: z.string().min(1).max(100),
      reason: z.enum(["harassment", "commercial", "inappropriate", "fake", "other"]),
      note: z.string().max(1000).optional(),
    }),
  );
  // Nur melden, was die Person auch sehen kann – sonst liessen sich über Meldungen fremde Chats für die Moderation öffnen
  const uuid = /^[0-9a-f-]{36}$/i.test(b.targetId) ? b.targetId : null;
  if (!uuid) throw err.invalid("Unbekanntes Ziel.");
  const [visible] =
    b.targetType === "loan" ? await sql`select 1 from loans where id = ${uuid} and (owner_id = ${u.id} or borrower_id = ${u.id})`
    : b.targetType === "message" ? await sql`select 1 from messages m left join loans l on l.id = m.loan_id
         left join handover_chats hc on hc.id = m.handover_chat_id
         left join loans p on p.id = hc.prev_loan_id left join loans n on n.id = hc.next_loan_id
        where m.id = ${uuid} and (${u.id} in (l.owner_id, l.borrower_id, p.borrower_id, n.borrower_id, n.owner_id))`
    : b.targetType === "copy" ? await sql`select 1 from copies where id = ${uuid} and copy_visible_to(id, ${u.id})`
    : b.targetType === "photo" ? await sql`select 1 from copy_photos p where p.id = ${uuid} and copy_visible_to(p.copy_id, ${u.id})`
    : b.targetType === "user" ? await sql`select 1 from users where id = ${uuid} and deleted_at is null`
    : await sql`select 1 from editions where id = ${uuid}`;
  if (!visible) throw err.notFound();
  await sql`insert into reports (reporter_id, target_type, target_id, reason, note) values (${u.id}, ${b.targetType}, ${b.targetId}, ${b.reason}, ${b.note ?? null})`;
  return { ok: true };
});
