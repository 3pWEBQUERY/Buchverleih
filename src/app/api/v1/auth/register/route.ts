import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { getLocale } from "@/lib/i18n/server";
import { body, route } from "@/lib/api";
import { registerWithPassword } from "@/lib/auth/flows";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";

/**
 * POST /api/v1/auth/register – Konto mit E-Mail und Passwort anlegen und gleich anmelden.
 * Mit client = "api" kommt ein Sitzungstoken zurück (iOS-App), sonst ein Cookie.
 */
export const POST = route(async (req) => {
  await rateLimit(`registerip:${clientIp(req)}`, 10, 3600);
  const b = await body(req, z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(500), client: z.enum(["web", "api"]).default("web") }));
  const { userId, created } = await registerWithPassword(b.email, b.password, await getLocale());
  const s = await createSession(userId, b.client);
  if (b.client === "web") {
    await setSessionCookie(s.token, s.maxAge);
    return { ok: true, created };
  }
  return { ok: true, created, token: s.token, expiresIn: s.maxAge };
});
