import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { notesForCopy } from "@/lib/book-path";

/**
 * GET /api/v1/copies/:id/notes – Zettel im Buch, öffentlich wie die Exemplarseite.
 * Je Zettel Text, Vorname (null, wenn anonym) und Monat. Ausgeblendete sieht nur die Besitzerin.
 */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getUser();
  return { notes: await notesForCopy(p.id, u && !u.banned_at ? u.id : null) };
});
