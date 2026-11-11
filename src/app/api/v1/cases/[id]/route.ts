import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { resolveCase, respondToCase } from "@/lib/loans/service";

/** POST /api/v1/cases/:id – Antwort des Leihers oder Bestätigung des Verleihers */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("respond"), response: z.enum(["return_date", "replace_same", "replace_other", "swap_offer", "object"]), detail: z.string().max(500).optional(), returnAt: z.string().optional(), swapCopyId: z.string().uuid().optional() }),
      z.object({ action: z.literal("resolve"), outcome: z.enum(["returned", "replaced"]) }),
    ]),
  );
  if (b.action === "respond") return respondToCase(u, p.id, b);
  return resolveCase(u, p.id, b.outcome);
});
