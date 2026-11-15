import { z } from "zod";
import { body, requestLocale, route } from "@/lib/api";
import { joinWaitlist } from "@/lib/account";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";

/** POST /api/v1/waitlist – Warteliste pro Postleitzahl vor der Freischaltung (PRD 14) */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ email: z.string().email().max(200), plz: z.string().regex(/^\d{4}$/) }));
  await rateLimit(`waitlistip:${clientIp(req)}`, 10, 3600);
  await rateLimit("waitlist:all", 500, 3600);
  await rateLimit(`waitlist:${b.email.toLowerCase()}`, 5, 3600);
  await joinWaitlist(b.email, b.plz, requestLocale(req));
  return { ok: true };
});
