import { readLimited, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { putObject } from "@/lib/storage";

/**
 * PUT /api/v1/uploads/:id/content – Rückfall, falls der Browser nicht direkt in den
 * Bucket laden kann (z. B. ohne CORS). Gleiche Grenzen wie der vorsignierte POST.
 */
export const PUT = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const [up] = await sql<{ raw_key: string; content_type: string; max_bytes: number }[]>`
    select raw_key, content_type, max_bytes from uploads where id = ${p.id} and user_id = ${u.id} and status = 'pending'`;
  if (!up) throw err.notFound();
  const buf = Buffer.from(await readLimited(req, up.max_bytes + 1024));
  if (buf.length > up.max_bytes + 1024 || buf.length < 1000) throw err.invalid("Die Datei ist zu gross oder leer.");
  await putObject(up.raw_key, buf, up.content_type);
  return { ok: true };
});
