import { z } from "zod";
import { query, route } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { logSearch, searchWorks } from "@/lib/search";
import { plzInfo } from "@/lib/account";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";

const flag = z.enum(["1", "0"]).optional();

/**
 * GET /api/v1/search – Werke mit Exemplaren in der Nähe. Abgemeldet mit ?plz=
 * Schnellfilter (alle mit «1» an, kombiniert mit UND): frei (heute frei, wie available), nah (≤ 2 km),
 * post (Versand möglich), kreis (aus eigenen Kreisen; abgemeldet ohne Wirkung).
 */
export const GET = route(async (req) => {
  const u = await getViewer();
  await rateLimit(u ? `search:${u.id}` : `searchip:${clientIp(req)}`, 1200, 3600);
  const q = query(
    req,
    z.object({
      q: z.string().max(120).optional(),
      radius: z.coerce.number().min(1).max(50).optional(),
      offer: z.enum(["lend", "swap", "gift"]).optional(),
      available: flag,
      frei: flag,
      nah: flag,
      post: flag,
      kreis: flag,
      language: z.string().max(5).optional(),
      genre: z.string().max(40).optional(),
      condition: z.coerce.number().int().min(1).max(4).optional(),
      plz: z.string().regex(/^\d{4}$/).optional(),
    }),
  );
  let origin = u?.home_lat != null ? { lat: u.home_lat, lng: u.home_lng! } : null;
  if (!origin && q.plz) {
    const p = await plzInfo(q.plz);
    if (p) origin = { lat: p.lat, lng: p.lng };
  }
  const hits = await searchWorks(u?.id ?? null, origin, {
    q: q.q,
    radiusKm: q.radius ?? u?.radius_km,
    offer: q.offer,
    availableNow: q.available === "1" || q.frei === "1",
    language: q.language,
    genre: q.genre,
    maxCondition: q.condition,
    near: q.nah === "1",
    shipping: q.post === "1",
    inCircle: q.kreis === "1",
  });
  if (q.q && q.q.length >= 2) logSearch(u?.id ?? null, q.q, hits).catch(() => {});
  // Kartenmitte nur grob (0.01°), nicht der gespeicherte Wohnort
  const center = origin ? { lat: Math.round(origin.lat * 100) / 100, lng: Math.round(origin.lng * 100) / 100 } : null;
  return { results: hits, center };
});
