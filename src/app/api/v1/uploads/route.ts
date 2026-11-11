import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, keys, presignUpload } from "@/lib/storage";

/**
 * POST /api/v1/uploads – vorsignierten POST für den Bucket ausstellen (PRD 10.3).
 * Beschränkt auf Bildtypen und eine Höchstgrösse. Der Client lädt direkt in den Bucket.
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`upload:${u.id}`, 60, 3600);
  if (!env.s3.configured) throw err.conflict("storage_off", "Fotos sind gerade nicht möglich. Versuche es später erneut.");
  const b = await body(
    req,
    z.object({
      purpose: z.enum(["copy_photo", "avatar", "case", "dropoff", "condition", "manual_cover"]),
      contentType: z.string().refine((t) => IMAGE_TYPES.includes(t), "Nur Fotos (JPEG, PNG, WebP, HEIC)"),
      size: z.number().int().min(1000).max(MAX_UPLOAD_BYTES),
      refId: z.string().uuid().optional(),
    }),
  );
  const id = crypto.randomUUID();
  const ref = b.refId ?? id;
  // Berechtigung je Zweck: nur eigene Exemplare, nur eigene Vorgänge
  if (b.purpose === "copy_photo" && b.refId) {
    const [c] = await sql`select 1 from copies where id = ${b.refId} and owner_id = ${u.id}`;
    if (!c) throw err.forbidden();
  }
  if ((b.purpose === "dropoff" || b.purpose === "condition" || b.purpose === "case") && b.refId) {
    const [l] = await sql`select 1 from loans where id = ${b.refId} and (owner_id = ${u.id} or borrower_id = ${u.id})`;
    if (!l) throw err.forbidden();
  }
  const finalKey =
    b.purpose === "copy_photo" || b.purpose === "manual_cover"
      ? keys.copyPhoto(u.id, ref, id)
      : b.purpose === "avatar"
        ? keys.avatar(u.id, id)
        : b.purpose === "dropoff"
          ? keys.dropoff(ref, id)
          : b.purpose === "condition"
            ? keys.condition(ref, id)
            : keys.case(ref, id);
  const rawKey = keys.raw(u.id, id);
  await sql`insert into uploads (id, user_id, purpose, raw_key, key, content_type, max_bytes)
            values (${id}, ${u.id}, ${b.purpose}, ${rawKey}, ${finalKey}, ${b.contentType}, ${b.size})`;
  const post = await presignUpload(rawKey, b.contentType, Math.min(MAX_UPLOAD_BYTES, b.size + 1024));
  return { id, key: finalKey, post, proxy: `/api/v1/uploads/${id}/content` };
});
