import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { portalUrl } from "@/lib/billing";

/** POST /api/v1/billing/portal – Kundenportal von Stripe (kündigen, Zahlungsmittel, Belege) */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ returnPath: z.string().regex(/^\/[A-Za-z0-9/_#?=-]*$/).max(200).default("/einstellungen") }));
  return { url: await portalUrl(u, b.returnPath) };
});
