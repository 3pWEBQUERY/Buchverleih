import { clientIp } from "@/lib/client-ip";
import { getLocale } from "@/lib/i18n/server";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { requestEmailLink } from "@/lib/auth/flows";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/auth/email – Anmeldelink anfordern */
export const POST = route(async (req) => {
  // Zusätzlich pro Absender begrenzen, damit niemand fremde Postfächer mit Links flutet
  await rateLimit(`loginip:${clientIp(req)}`, 20, 3600);
  // Gesamtdeckel: schützt den Ruf der Absenderadresse, auch bei vielen IPs
  await rateLimit("login:global", 500, 3600);
  const b = await body(req, z.object({ email: z.string().min(3).max(200), next: z.string().max(300).nullish() }));
  const r = await requestEmailLink(b.email, b.next, await getLocale());
  return { ok: true, ...r };
});
