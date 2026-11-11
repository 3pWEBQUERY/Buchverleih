import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { redeemToken } from "@/lib/loans/handover";

/** POST /api/v1/handover/redeem – gescannten QR-Code einlösen */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ token: z.string().min(10).max(200) }));
  return redeemToken(u, b.token.replace(/^.*\/h\//, ""));
});
