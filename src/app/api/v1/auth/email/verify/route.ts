import { z } from "zod";
import { body, route } from "@/lib/api";
import { verifyEmailLink } from "@/lib/auth/flows";
import { createSession, setSessionCookie } from "@/lib/auth/session";

/**
 * POST /api/v1/auth/email/verify – Link einlösen.
 * Mit client = "api" kommt ein Sitzungstoken zurück (iOS-App), sonst ein Cookie.
 */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ token: z.string().min(20), client: z.enum(["web", "api"]).default("web") }));
  const { userId, created } = await verifyEmailLink(b.token);
  const s = await createSession(userId, b.client);
  if (b.client === "web") {
    await setSessionCookie(s.token, s.maxAge);
    return { ok: true, created };
  }
  return { ok: true, created, token: s.token, expiresIn: s.maxAge };
});
