import { z } from "zod";
import { body, isoDay, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import * as svc from "@/lib/loans/service";
import { passOnConsent } from "@/lib/loans/passon";
import { createToken, redeemCode } from "@/lib/loans/handover";

/**
 * POST /api/v1/loans/:id/actions – eine Handlung im Vorgang.
 * Der Name entspricht der Handlung in der Zustandsmaschine (src/lib/loans/machine.ts).
 */
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), pickupSpotId: z.string().uuid().nullish(), proposalAt: z.string().datetime({ offset: true }).nullish(), proposalPlace: z.string().max(120).nullish(), swapCopyId: z.string().uuid().nullish() }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("cancel_without_penalty") }),
  z.object({ action: z.literal("show_code") }),
  z.object({ action: z.literal("enter_code"), code: z.string().min(6).max(8) }),
  z.object({ action: z.literal("report_handover"), dropoffPhotoKey: z.string().max(300).nullish() }),
  z.object({ action: z.literal("confirm_handover") }),
  z.object({ action: z.literal("object_handover") }),
  z.object({ action: z.literal("condition_note"), note: z.string().max(500), photoKeys: z.array(z.string().max(300)).max(6).default([]) }),
  z.object({ action: z.literal("extend") }),
  z.object({ action: z.literal("grant_extension") }),
  z.object({ action: z.literal("recall") }),
  z.object({ action: z.literal("report_return") }),
  z.object({ action: z.literal("confirm_return") }),
  z.object({ action: z.literal("object_return") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("report_damage"), description: z.string().min(5).max(1000), photoKeys: z.array(z.string().max(300)).min(1).max(6) }),
  z.object({ action: z.literal("open_case"), description: z.string().max(1000).optional() }),
  z.object({ action: z.literal("offer_swap"), copyId: z.string().uuid() }),
  z.object({ action: z.literal("accept_swap_offer") }),
  z.object({ action: z.literal("clear_loss") }),
  z.object({ action: z.literal("pass_on_consent"), agree: z.boolean() }),
  z.object({ action: z.literal("start_earlier"), start: isoDay }),
  z.object({ action: z.literal("reschedule"), start: isoDay, end: isoDay }),
  z.object({ action: z.literal("rate"), verdict: z.enum(["good", "problems"]), reasons: z.array(z.enum(["late", "condition", "communication", "no_show"])).default([]), note: z.string().max(500).optional() }),
]);

export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, schema);
  const id = p.id;
  switch (b.action) {
    case "accept": return svc.accept(u, id, b);
    case "decline": return svc.decline(u, id);
    case "withdraw": return svc.withdraw(u, id);
    case "cancel": return svc.cancel(u, id);
    case "cancel_without_penalty": return svc.cancelWithoutPenalty(u, id);
    case "show_code": return createToken(u, id);
    case "enter_code": return redeemCode(u, id, b.code);
    case "report_handover": return svc.reportHandover(u, id, b);
    case "confirm_handover": return svc.confirmHandover(u, id);
    case "object_handover": return svc.objectHandover(u, id);
    case "condition_note": return svc.addConditionNote(u, id, b);
    case "extend": return svc.extend(u, id);
    case "grant_extension": return svc.grantExtension(u, id);
    case "recall": return svc.recall(u, id);
    case "report_return": return svc.reportReturn(u, id);
    case "confirm_return": return svc.confirmReturn(u, id);
    case "object_return": return svc.objectReturn(u, id);
    case "complete": return svc.complete(u, id);
    case "report_damage": return svc.reportDamage(u, id, b);
    case "open_case": return svc.openCase(u, id, b.description);
    case "offer_swap": return svc.offerSwap(u, id, b.copyId);
    case "accept_swap_offer": return svc.acceptSwapOffer(u, id);
    case "clear_loss": return svc.clearLoss(u, id);
    case "pass_on_consent": return passOnConsent(u, id, b.agree);
    case "start_earlier": return svc.startEarlier(u, id, b.start);
    case "reschedule": return svc.reschedule(u, id, b.start, b.end);
    case "rate": return svc.rate(u, id, b);
  }
});
