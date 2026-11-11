import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertMember, listMessages, sendMessage, type Thread } from "@/lib/chat";

const thread = z.object({ loan: z.string().uuid().optional(), chat: z.string().uuid().optional(), after: z.string().uuid().optional() });

function toThread(q: { loan?: string; chat?: string }): Thread {
  if (q.loan) return { type: "loan", id: q.loan };
  if (q.chat) return { type: "handover", id: q.chat };
  throw new Error("loan oder chat fehlt");
}

/** GET /api/v1/messages?loan=… oder ?chat=… */
export const GET = route(async (req) => {
  const u = await requireUser();
  const q = query(req, thread);
  const t = toThread(q);
  const m = await assertMember(t, u.id);
  return { messages: await listMessages(t, q.after), readOnly: m.readOnly };
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
