import { clientIp } from "@/lib/client-ip";
import { route } from "@/lib/api";
import { passkeyLoginOptions } from "@/lib/auth/flows";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/auth/passkey/options – Anmeldung per Passkey vorbereiten (pro IP begrenzt) */
export const POST = route(async (req) => {
  await rateLimit(`passkeyopt:${clientIp(req)}`, 60, 3600);
  await rateLimit("passkeyopt:global", 3000, 3600);
  return passkeyLoginOptions();
});
