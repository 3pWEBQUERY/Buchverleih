import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertPostInCircle, offerCopy } from "@/lib/pinboard";

/**
 * POST /api/v1/circles/:id/posts/:postId/offer – «Ich hab's»: eigenes Exemplar auf einen Suchzettel anbieten.
 * Es entsteht kein Vorgang: die suchende Person erhält eine Benachrichtigung mit dem Link zum Exemplar
 * und stellt dort die normale Anfrage.
 */
export const POST = route<{ id: string; postId: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ copyId: z.string().uuid() }));
  await assertPostInCircle(p.postId, p.id);
  return offerCopy(u.id, p.postId, b.copyId);
});
