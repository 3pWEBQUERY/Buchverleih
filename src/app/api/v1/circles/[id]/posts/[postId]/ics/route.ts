import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { announcementIcs, assertPostInCircle } from "@/lib/pinboard";

/** GET /api/v1/circles/:id/posts/:postId/ics – Ankündigung mit Termin als Kalenderdatei */
export const GET = route<{ id: string; postId: string }>(async (_req, p) => {
  const u = await requireUser();
  await assertPostInCircle(p.postId, p.id);
  const ics = await announcementIcs(u.id, p.postId);
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="termin.ics"' } });
});
