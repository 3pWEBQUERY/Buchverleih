import { z } from "zod";
import { query, route, uuid } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { pulse } from "@/lib/pulse";

/**
 * GET /api/v1/me/pulse?circle= – «Diese Woche in deinen Kreisen»: nur Aggregiertes oder selbst
 * Veröffentlichtes (gewanderte Bücher als Zahl, neu eingestellte Bücher, neue Zettel).
 */
export const GET = route(async (req) => {
  const u = await requireUser();
  const q = query(req, z.object({ circle: uuid.optional() }));
  return { items: await pulse(u.id, { circleId: q.circle }) };
});
