import { z } from "zod";
import { body, isoDay, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createPost, getPost, listPosts } from "@/lib/pinboard";

/**
 * GET /api/v1/circles/:id/posts?before=&limit= – Pinnwand des Kreises, neueste zuerst.
 * `before` ist `nextBefore` der vorherigen Seite. Nur aktive Mitglieder.
 */
export const GET = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const q = query(req, z.object({ before: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }));
  return listPosts(p.id, u.id, q);
});

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("search"), workId: z.string().uuid(), neededBy: isoDay.nullish(), text: z.string().max(280).nullish() }),
  z.object({ kind: z.literal("recommend"), copyId: z.string().uuid(), text: z.string().min(1).max(280) }),
  z.object({ kind: z.literal("announce"), text: z.string().min(1).max(500), eventAt: z.string().datetime({ offset: true }).nullish(), eventPlace: z.string().max(120).nullish() }),
]);

/** POST /api/v1/circles/:id/posts – Zettel anheften: Suche, Empfehlung oder Ankündigung (nur Admins) */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const id = await createPost(u.id, p.id, await body(req, schema));
  return { id, post: await getPost(p.id, u.id, id) };
});
