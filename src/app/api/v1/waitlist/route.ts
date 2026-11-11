import { z } from "zod";
import { body, route } from "@/lib/api";
import { joinWaitlist } from "@/lib/account";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/waitlist – Warteliste pro Postleitzahl vor der Freischaltung (PRD 14) */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ email: z.string().email().max(200), plz: z.string().regex(/^\d{4}$/) }));
  await rateLimit(`waitlist:${b.email}`, 5, 3600);
  await joinWaitlist(b.email, b.plz);
  return { ok: true };
});
