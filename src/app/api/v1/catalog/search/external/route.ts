import { z } from "zod";
import { query, requestLocale, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { searchExternal } from "@/lib/catalog/lookup";
import { rateLimit } from "@/lib/ratelimit";

/**
 * GET /api/v1/catalog/search/external?q= – Titelsuche in Google Books und Open Library, wenn der eigene
 * Katalog nichts findet. Übernommen wird ein Treffer über GET /catalog/isbn/:isbn (speichert Ausgabe und lädt das Cover).
 */
export const GET = route(async (req) => {
  const u = await requireUser();
  const q = query(req, z.object({ q: z.string().min(2).max(120) }));
  await rateLimit(`catsearch:${u.id}`, 60, 3600);
  return { results: await searchExternal(q.q, 12, requestLocale(req)) };
});
