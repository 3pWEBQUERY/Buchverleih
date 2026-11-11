import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { joinCircle } from "@/lib/circles";

/** POST /api/v1/circles/join – Beitritt per Einladungslink */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ code: z.string().min(6).max(20) }));
  return joinCircle(u.id, b.code);
});
