import { z } from "zod";
import { query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { shelvesInCells } from "@/lib/search";
import { rateLimit } from "@/lib/ratelimit";

/** GET /api/v1/search/shelves?cells=47.52,8.54;47.53,8.55 – Regale in Kartenzellen (Tippen auf die Karte öffnet das Regal) */
export const GET = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`mapshelves:${u.id}`, 600, 3600);
  const q = query(req, z.object({ cells: z.string().max(400) }));
  const cells = q.cells.split(";").slice(0, 20).map((c) => c.split(",").map(Number) as [number, number])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180);
  return { shelves: await shelvesInCells(u.id, cells) };
});
