import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { wishersInMyCircles } from "@/lib/wishlist";

/**
 * GET /api/v1/copies/:id/wishers – wer in meinen Kreisen dieses Buch sucht (nur für das eigene Exemplar).
 * Vornamen nur von Mitgliedern gemeinsamer Kreise, die ihren Wunsch dort teilen.
 */
export const GET = route<{ id: string }>(async (_req, p) => wishersInMyCircles((await requireUser()).id, p.id));
