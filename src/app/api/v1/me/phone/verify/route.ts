import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { verifyPhoneCode } from "@/lib/auth/flows";

/** POST /api/v1/me/phone/verify */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ code: z.string().min(6).max(10) }));
  await verifyPhoneCode(u, b.code);
  return { ok: true };
});
