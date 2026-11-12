import { getLocale } from "@/lib/i18n/server";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { requestEmailLink } from "@/lib/auth/flows";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/auth/email – Anmeldelink anfordern */
export const POST = route(async (req) => {
  // Zusätzlich pro Absender begrenzen, damit niemand fremde Postfächer mit Links flutet
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unbekannt";
  await rateLimit(`loginip:${ip}`, 20, 3600);
  const b = await body(req, z.object({ email: z.string().min(3).max(200), next: z.string().max(300).nullish() }));
  const r = await requestEmailLink(b.email, b.next, await getLocale());
  return { ok: true, ...r };
});
