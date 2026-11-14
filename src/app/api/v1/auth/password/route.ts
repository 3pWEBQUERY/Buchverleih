import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { body, route } from "@/lib/api";
import { loginWithPassword } from "@/lib/auth/flows";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/auth/password – Anmelden mit E-Mail und Passwort (client = "api": Token statt Cookie) */
export const POST = route(async (req) => {
  await rateLimit(`pwloginip:${clientIp(req)}`, 30, 900);
  const b = await body(req, z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(500), client: z.enum(["web", "api"]).default("web") }));
  const { userId, created } = await loginWithPassword(b.email, b.password);
  const s = await createSession(userId, b.client);
  if (b.client === "web") {
    await setSessionCookie(s.token, s.maxAge);
    return { ok: true, created };
  }
  return { ok: true, created, token: s.token, expiresIn: s.maxAge };
});
