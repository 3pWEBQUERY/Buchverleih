import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

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
  await sql`insert into reports (reporter_id, target_type, target_id, reason, note) values (${u.id}, ${b.targetType}, ${b.targetId}, ${b.reason}, ${b.note ?? null})`;
  return { ok: true };
});
