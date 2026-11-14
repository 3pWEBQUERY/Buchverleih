import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { setNoteHidden } from "@/lib/book-path";

/** PATCH /api/v1/notes/:id – Zettel im eigenen Buch ausblenden oder wieder zeigen (nur die Besitzerin) */
export const PATCH = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ hidden: z.boolean() }));
  await setNoteHidden(u.id, p.id, b.hidden);
  return { ok: true };
});
