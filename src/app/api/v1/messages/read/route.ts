import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { err } from "@/lib/errors";
import { markRead, type Thread } from "@/lib/chat";

/**
 * POST /api/v1/messages/read – Thread als gelesen markieren: { loan | chat, upTo? }.
 * Mit `upTo` bis zu dieser Nachricht, sonst bis zur neuesten. Der Stand wandert nur vorwärts.
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ loan: z.string().uuid().optional(), chat: z.string().uuid().optional(), upTo: z.string().uuid().optional() }));
  if (!b.loan === !b.chat) throw err.invalid("Gib entweder einen Vorgang oder einen Übergabe-Chat an.");
  const t: Thread = b.loan ? { type: "loan", id: b.loan } : { type: "handover", id: b.chat! };
  return markRead(u.id, t, b.upTo);
});
