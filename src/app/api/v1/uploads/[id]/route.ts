import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/jobs";

/** POST /api/v1/uploads/:id – Upload abgeschlossen; der Worker erzeugt die Varianten */
export const POST = route<{ id: string }>(async (_req, p) => {
  const u = await requireUser();
  return sql.begin(async (tx) => {
    const r = await tx`update uploads set status = 'uploaded' where id = ${p.id} and user_id = ${u.id} and status = 'pending' returning key`;
    if (!r.length) throw err.notFound();
    await enqueue(tx, "process_upload", { uploadId: p.id });
    return { ok: true, key: r[0].key };
  });
});

/** GET /api/v1/uploads/:id – Stand der Verarbeitung */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await requireUser();
  const [r] = await sql`select status, key, width, height from uploads where id = ${p.id} and user_id = ${u.id}`;
  if (!r) throw err.notFound();
  return r;
});
