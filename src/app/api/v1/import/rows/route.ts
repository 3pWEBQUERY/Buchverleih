import { z } from "zod";
import { body, requestLocale, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { importRows } from "@/lib/import";
import { rateLimit } from "@/lib/ratelimit";

const row = z.object({
  key: z.string().max(260),
  title: z.string().min(1).max(200),
  authors: z.array(z.string().max(100)).max(5),
  isbn13: z.string().regex(/^\d{13}$/).nullable(),
  status: z.enum(["read", "reading", "to-read", "dnf", "other"]),
  owned: z.boolean().nullable(),
  year: z.number().int().min(1450).max(2100).nullable(),
  target: z.enum(["shelf", "wish"]),
});

/** POST /api/v1/import/rows – bis zu 10 gewählte Bücher übernehmen (ins Regal oder auf die Wunschliste) */
export const POST = route(async (req) => {
  const u = await requireUser();
  // Grosszügig für ganze Bibliotheken (3000 Bücher am Tag), aber kein Dauerfeuer auf die Kataloge
  await rateLimit(`importrows:${u.id}`, 300, 86400);
  const b = await body(req, z.object({
    rows: z.array(row).min(1).max(10),
    settings: z.object({
      condition: z.number().int().min(1).max(4).optional(),
      offers: z.array(z.enum(["lend", "swap", "gift"])).max(3).optional(),
      visibility: z.enum(["all", "proven", "circles"]).optional(),
    }).default({}),
  }));
  return { results: await importRows(u, b.rows, b.settings, requestLocale(req)) };
});
