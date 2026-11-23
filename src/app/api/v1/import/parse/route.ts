import { readLimited, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { parseLibrary, suggestTarget } from "@/lib/import";
import { rateLimit } from "@/lib/ratelimit";

/**
 * POST /api/v1/import/parse – CSV-Export aus Goodreads oder StoryGraph lesen (Body: die Datei als Text, höchstens 3 MB).
 * Speichert nichts; liefert die erkannten Bücher mit einem Vorschlag (Regal, Wunschliste, überspringen).
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`importparse:${u.id}`, 30, 3600);
  const text = new TextDecoder().decode(await readLimited(req, 3 * 1024 * 1024));
  const { format, rows } = parseLibrary(text);
  return { format, rows: rows.map((r) => ({ ...r, suggested: suggestTarget(r) })) };
});
