import { route } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { ratingProfile } from "@/lib/rating-profile";
import { listVisibleShelf } from "@/lib/copies";
import { err } from "@/lib/errors";

/** GET /api/v1/users/:id – Profil: drei Zahlen, Stufe, Regal. Keine Biografie. */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getViewer();
  const profile = await publicProfile(p.id, u?.id ?? null);
  if (!profile) throw err.notFound();
  const [shelf, ratings] = await Promise.all([listVisibleShelf(p.id, u?.id ?? null), profile.deleted ? null : ratingProfile(p.id)]);
  return { profile, shelf, ratings };
});
