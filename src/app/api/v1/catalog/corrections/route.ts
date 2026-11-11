import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";

/** POST /api/v1/catalog/corrections – Fehler in Titeldaten melden; die Moderation prüft */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ editionId: z.string().uuid(), field: z.enum(["title", "authors", "publisher", "year", "language", "genre"]), suggestion: z.string().min(1).max(300) }));
  await sql`insert into catalog_corrections (edition_id, user_id, field, suggestion) values (${b.editionId}, ${u.id}, ${b.field}, ${b.suggestion})`;
  return { ok: true };
});
