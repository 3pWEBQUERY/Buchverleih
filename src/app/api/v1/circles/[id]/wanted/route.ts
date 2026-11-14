import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { wantedInCircle } from "@/lib/wishlist";

/** GET /api/v1/circles/:id/wanted – Brett «Gesucht im Kreis»: geteilte Wünsche der Mitglieder, ohne Namen */
export const GET = route<{ id: string }>(async (_req, p) => ({ wanted: await wantedInCircle(p.id, (await requireUser()).id) }));
