import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { setPassword } from "@/lib/auth/flows";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/me/password – Passwort setzen oder ändern */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`setpw:${u.id}`, 10, 3600);
  const b = await body(req, z.object({ password: z.string().min(1).max(500) }));
  await setPassword(u.id, b.password);
  return { ok: true };
});
