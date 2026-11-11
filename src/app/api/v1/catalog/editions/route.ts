import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createManualEdition } from "@/lib/catalog/works";

/** POST /api/v1/catalog/editions – Buch ohne ISBN oder ohne Treffer von Hand erfassen */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.object({
      title: z.string().min(1).max(200),
      authors: z.array(z.string().max(100)).max(5),
      year: z.number().int().min(1450).max(2100).nullish(),
      language: z.string().max(5).nullish(),
      publisher: z.string().max(120).nullish(),
      genre: z.string().max(40).nullish(),
      isbn: z.string().max(20).nullish(),
    }),
  );
  return { edition: await createManualEdition(u.id, b) };
});
