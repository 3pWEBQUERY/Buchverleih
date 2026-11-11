import { route } from "@/lib/api";
import { passkeyLoginOptions } from "@/lib/auth/flows";

/** POST /api/v1/auth/passkey/options – Anmeldung per Passkey vorbereiten */
export const POST = route(async () => passkeyLoginOptions());
