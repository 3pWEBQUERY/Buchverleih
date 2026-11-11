import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { proposalIcs } from "@/lib/chat";

/** GET /api/v1/messages/:id/ics – angenommenen Termin als Kalenderdatei */
export const GET = route<{ id: string }>(async (_req, p) => {
  const ics = await proposalIcs((await requireUser()).id, p.id);
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="uebergabe.ics"' } });
});
