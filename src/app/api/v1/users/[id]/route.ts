import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { listVisibleShelf } from "@/lib/copies";
import { err } from "@/lib/errors";

/** GET /api/v1/users/:id – Profil: drei Zahlen, Stufe, Regal. Keine Biografie. */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getUser();
  const profile = await publicProfile(p.id, u?.id ?? null);
  if (!profile) throw err.notFound();
  return { profile, shelf: await listVisibleShelf(p.id, u?.id ?? null) };
});
