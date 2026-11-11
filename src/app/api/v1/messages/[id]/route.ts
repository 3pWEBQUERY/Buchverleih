import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { acceptProposal } from "@/lib/chat";

/** POST /api/v1/messages/:id – Terminvorschlag annehmen */
export const POST = route<{ id: string }>(async (_req, p) => acceptProposal((await requireUser()).id, p.id));
