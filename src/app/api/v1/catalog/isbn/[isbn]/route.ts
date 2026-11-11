import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { editionByIsbn } from "@/lib/catalog/works";
import { err } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";

/** GET /api/v1/catalog/isbn/:isbn – Ausgabe zu einer ISBN (eigene Datenbank, dann DNB, Open Library, Google Books) */
export const GET = route<{ isbn: string }>(async (_req, p) => {
  const u = await getUser();
  if (!u) throw err.unauthorized();
  await rateLimit(`isbn:${u.id}`, 120, 3600);
  const edition = await editionByIsbn(p.isbn, u.id);
  return { edition };
});
