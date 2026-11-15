import { route } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { relatedForCopy } from "@/lib/copies";

/** GET /api/v1/copies/:id/related – Weiterstöbern: Regal der Person, gleicher Titel, Autorin, Genre, neu in der Nähe */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getViewer();
  const origin = u?.home_lat != null ? { lat: u.home_lat, lng: u.home_lng! } : null;
  return { related: await relatedForCopy(p.id, u?.id ?? null, origin), hasOrigin: Boolean(origin) };
});
