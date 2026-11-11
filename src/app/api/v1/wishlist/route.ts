import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addWish, listWishlist, mySwapMatches, removeWish, updateWish } from "@/lib/wishlist";

export const GET = route(async () => {
  const u = await requireUser();
  return { items: await listWishlist(u.id), matches: await mySwapMatches(u.id) };
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ workId: z.string().uuid(), radiusKm: z.number().int().min(1).max(50).optional() }));
  await addWish(u.id, u.plan_id, b.workId, b.radiusKm);
  return { ok: true };
});

export const PATCH = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ workId: z.string().uuid(), radiusKm: z.number().int().min(1).max(50).optional(), alarm: z.boolean().optional() }));
  await updateWish(u.id, b.workId, b);
  return { ok: true };
});

export const DELETE = route(async (req) => {
  const u = await requireUser();
  await removeWish(u.id, new URL(req.url).searchParams.get("work") ?? "");
  return { ok: true };
});
