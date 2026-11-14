import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { leaveNote } from "@/lib/book-path";

/**
 * POST /api/v1/loans/:id/note – Zettel im Buch: ein Satz für die nächsten Leserinnen und Leser.
 * Nur die leihende Person, nur nach Abschluss (solange die Bewertungsfrist läuft), einmal pro Leihe.
 */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ body: z.string().min(1).max(200), anonymous: z.boolean().optional() }));
  return { id: await leaveNote(u.id, p.id, b) };
});
