import { z } from "zod";
import { query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { suggestEditions } from "@/lib/catalog/works";

/** GET /api/v1/catalog/search?q= – Ausgaben im Katalog (manuelle Erfassung) */
export const GET = route(async (req) => {
  await requireUser();
  const q = query(req, z.object({ q: z.string().max(120) }));
  return { editions: await suggestEditions(q.q) };
});
