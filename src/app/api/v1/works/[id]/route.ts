import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { copiesOfWork } from "@/lib/copies";
import { err } from "@/lib/errors";

/** GET /api/v1/works/:id – Titelseite: Exemplare in der Nähe */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getUser();
  const [work] = await sql`select id, title, subtitle, authors, genre, original_language from works where id = ${p.id}`;
  if (!work) throw err.notFound();
  const origin = u?.home_lat != null ? { lat: u.home_lat, lng: u.home_lng! } : null;
  return { work, copies: await copiesOfWork(p.id, u?.id ?? null, origin) };
});
