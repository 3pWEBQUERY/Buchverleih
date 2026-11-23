import { z } from "zod";
import { body, requestLocale, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { startCheckout } from "@/lib/billing";
import { rateLimit } from "@/lib/ratelimit";

/** POST /api/v1/billing/checkout – Bezahlseite für Fördermitgliedschaft oder Kreis für Organisationen öffnen */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`checkout:${u.id}`, 20, 3600);
  const b = await body(req, z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("supporter"), interval: z.enum(["month", "year"]) }),
    z.object({ kind: z.literal("organization"), circleId: z.string().uuid() }),
  ]));
  return { url: await startCheckout(u, b, requestLocale(req)) };
});
