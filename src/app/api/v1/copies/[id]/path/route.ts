import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { bookPath } from "@/lib/book-path";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";

/**
 * GET /api/v1/copies/:id/path – der Weg eines Buches, anonym: Hände, Gemeinden, Stationen (Gemeinde, Monat).
 * path ist null, solange es weniger als zwei abgeschlossene Übergaben gibt.
 */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getUser();
  const viewer = u && !u.banned_at ? u.id : null;
  const [c] = await sql<{ ok: boolean }[]>`select (owner_id = ${viewer}::uuid or copy_visible_to(id, ${viewer}::uuid)) as ok from copies where id = ${p.id}`;
  if (!c?.ok) throw err.notFound("Dieses Buch ist nicht mehr verfügbar.");
  return { path: await bookPath(p.id) };
});
