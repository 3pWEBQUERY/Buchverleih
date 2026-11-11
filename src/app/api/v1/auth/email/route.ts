import { z } from "zod";
import { body, route } from "@/lib/api";
import { requestEmailLink } from "@/lib/auth/flows";

/** POST /api/v1/auth/email – Anmeldelink anfordern */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ email: z.string().min(3).max(200), next: z.string().max(300).nullish() }));
  const r = await requestEmailLink(b.email, b.next);
  return { ok: true, ...r };
});
