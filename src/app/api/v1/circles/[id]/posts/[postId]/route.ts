import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { err } from "@/lib/errors";
import { assertPostInCircle, deletePost, getPost, setFulfilled } from "@/lib/pinboard";

type P = { id: string; postId: string };

/** GET /api/v1/circles/:id/posts/:postId – ein Zettel in derselben Form wie in der Liste (nach einem Live-Ereignis) */
export const GET = route<P>(async (_req, p) => {
  const u = await requireUser();
  const post = await getPost(p.id, u.id, p.postId);
  if (!post) throw err.notFound("Diesen Zettel gibt es nicht mehr.");
  return { post };
});

/** PATCH /api/v1/circles/:id/posts/:postId – Suche als erfüllt markieren (oder zurücknehmen), nur die suchende Person */
export const PATCH = route<P>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ fulfilled: z.boolean() }));
  await assertPostInCircle(p.postId, p.id);
  await setFulfilled(u.id, p.postId, b.fulfilled);
  return { ok: true };
});

/** DELETE /api/v1/circles/:id/posts/:postId – eigenen Zettel löschen; Admins entfernen jeden */
export const DELETE = route<P>(async (_req, p) => {
  const u = await requireUser();
  await assertPostInCircle(p.postId, p.id);
  await deletePost(u.id, p.postId);
  return { ok: true };
});
