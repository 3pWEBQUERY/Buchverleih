import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertMember, listMessages, sendMessage, threadReads, type Thread } from "@/lib/chat";

const thread = z.object({ loan: z.string().uuid().optional(), chat: z.string().uuid().optional(), after: z.string().uuid().optional(), id: z.string().uuid().optional() });

function toThread(q: { loan?: string; chat?: string }): Thread {
  if (q.loan) return { type: "loan", id: q.loan };
  if (q.chat) return { type: "handover", id: q.chat };
  throw new Error("loan oder chat fehlt");
}

/**
 * GET /api/v1/messages?loan=… oder ?chat=… – mit &after=<id> nur neuere, mit &id=<id> genau eine Nachricht.
 * `reads`: Lesestand der anderen Mitglieder ({ user_id, last_read_at }), für «Gelesen».
 */
export const GET = route(async (req) => {
  const u = await requireUser();
  const q = query(req, thread);
  const t = toThread(q);
  const m = await assertMember(t, u.id);
  const [messages, reads] = await Promise.all([listMessages(t, q.after, q.id), threadReads(t, u.id)]);
  return { messages, readOnly: m.readOnly, reads };
});

/** POST /api/v1/messages – Text oder Terminvorschlag */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.object({
      loan: z.string().uuid().optional(),
      chat: z.string().uuid().optional(),
      body: z.string().max(2000).nullish(),
      proposalPlace: z.string().max(120).nullish(),
      proposalAt: z.string().datetime({ offset: true }).nullish(),
    }),
  );
  return { id: await sendMessage(u.id, toThread(b), b) };
});
