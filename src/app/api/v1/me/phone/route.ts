import { clientIp } from "@/lib/client-ip";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { requestPhoneCode } from "@/lib/auth/flows";

/** POST /api/v1/me/phone – SMS-Code anfordern */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ phone: z.string().min(6).max(30) }));
  return { ok: true, ...(await requestPhoneCode(u, b.phone, clientIp(req))) };
});
