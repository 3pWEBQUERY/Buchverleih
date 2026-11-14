import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertPostInCircle, react, unreact, REACTION_KINDS } from "@/lib/pinboard";

type P = { id: string; postId: string };

/**
 * POST /api/v1/circles/:id/posts/:postId/reactions – «Danke» oder «Will ich auch lesen» setzen.
 * addToWishlist (nur bei want) legt den Titel zusätzlich auf die eigene Wunschliste.
 */
export const POST = route<P>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ kind: z.enum(REACTION_KINDS), addToWishlist: z.boolean().optional() }));
  await assertPostInCircle(p.postId, p.id);
  return react(u.id, p.postId, b.kind, { addToWishlist: b.addToWishlist });
});

/** DELETE /api/v1/circles/:id/posts/:postId/reactions?kind= – Reaktion zurücknehmen */
export const DELETE = route<P>(async (req, p) => {
  const u = await requireUser();
  const q = query(req, z.object({ kind: z.enum(REACTION_KINDS) }));
  await assertPostInCircle(p.postId, p.id);
  return unreact(u.id, p.postId, q.kind);
});
