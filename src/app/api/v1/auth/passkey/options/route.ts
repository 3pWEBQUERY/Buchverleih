import { route } from "@/lib/api";
import { passkeyLoginOptions } from "@/lib/auth/flows";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/auth/passkey/options – Anmeldung per Passkey vorbereiten (pro IP begrenzt) */
export const POST = route(async (req) => {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
  await rateLimit(`passkeyopt:${ip}`, 60, 3600);
  return passkeyLoginOptions();
});
