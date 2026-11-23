import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { takeOverLibraryCopy } from "@/lib/circles";

/** POST /api/v1/circles/:id/library – Admins: Betreuung eines Buchs der Kreisbibliothek übernehmen ({ copyId }) */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ copyId: z.string().uuid() }));
  await takeOverLibraryCopy(u.id, p.id, b.copyId);
  return { ok: true };
});
