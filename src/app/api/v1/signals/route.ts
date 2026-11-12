import { clientIp } from "@/lib/client-ip";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/signals – Nachfrage-Zähler, z. B. «Versand gewünscht» (PRD 11.3) */
export const POST = route(async (req) => {
  const u = await getUser();
  // Kennzahl nicht verfälschbar: pro Person bzw. IP höchstens wenige Signale pro Tag
  await rateLimit(`signal:${u?.id ?? clientIp(req)}`, 3, 86400);
  const b = await body(req, z.object({ key: z.enum(["shipping"]) }));
  await sql`insert into interest_signals (key, user_id) values (${b.key}, ${u?.id ?? null})`;
  return { ok: true };
});
