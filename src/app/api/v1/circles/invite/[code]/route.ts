import { route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { circleByInvite } from "@/lib/circles";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/ratelimit";
import { err } from "@/lib/errors";

/**
 * GET /api/v1/circles/invite/:code – Vorschau einer Einladung (wie die Seite /k/:code):
 * Name, Beschreibung, Mitgliederzahl, Beitrittsart und die eigene Mitgliedschaft. Keine Mitgliederliste.
 */
export const GET = route<{ code: string }>(async (req, p) => {
  await rateLimit(`circleinvite:${clientIp(req)}`, 60, 3600);
  const [user, circle] = await Promise.all([getUser(), circleByInvite(p.code)]);
  if (!circle) throw err.notFound("Dieser Einladungslink ist ungültig oder wurde erneuert.");
  const [m] = user
    ? await sql<{ status: "active" | "pending" }[]>`select status from circle_members where circle_id = ${circle.id} and user_id = ${user.id}`
    : [];
  return {
    circle: {
      id: m?.status === "active" ? circle.id : null,
      name: circle.name,
      description: circle.description ?? null,
      memberCount: Number(circle.member_count),
      joinMode: circle.join_mode,
    },
    membership: m?.status ?? null,
  };
});
