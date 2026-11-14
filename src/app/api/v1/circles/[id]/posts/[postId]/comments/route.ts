import { z } from "zod";
import { body, query, route, uuid } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addComment, assertPostInCircle, deleteComment, getPost } from "@/lib/pinboard";

type P = { id: string; postId: string };

/** POST /api/v1/circles/:id/posts/:postId/comments – Kommentar (eine Ebene, höchstens 500 Zeichen) */
export const POST = route<P>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ body: z.string().min(1).max(500) }));
  await assertPostInCircle(p.postId, p.id);
  const id = await addComment(u.id, p.postId, b.body);
  return { id, post: await getPost(p.id, u.id, p.postId) };
});

/** DELETE /api/v1/circles/:id/posts/:postId/comments?comment= – eigenen Kommentar löschen; Admins entfernen jeden */
export const DELETE = route<P>(async (req, p) => {
  const u = await requireUser();
  const q = query(req, z.object({ comment: uuid }));
  await assertPostInCircle(p.postId, p.id);
  await deleteComment(u.id, q.comment);
  return { ok: true };
});
