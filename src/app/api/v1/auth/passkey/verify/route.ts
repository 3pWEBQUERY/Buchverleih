import { z } from "zod";
import { body, route } from "@/lib/api";
import { passkeyLoginVerify } from "@/lib/auth/flows";
import { createSession, setSessionCookie } from "@/lib/auth/session";

/** POST /api/v1/auth/passkey/verify */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ challengeId: z.string().uuid(), response: z.any(), client: z.enum(["web", "api"]).default("web") }));
  const userId = await passkeyLoginVerify(b.challengeId, b.response);
  const s = await createSession(userId, b.client);
  if (b.client === "web") {
    await setSessionCookie(s.token, s.maxAge);
    return { ok: true };
  }
  return { ok: true, token: s.token, expiresIn: s.maxAge };
});
