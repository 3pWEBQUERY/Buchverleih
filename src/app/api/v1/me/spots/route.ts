import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addSpot, listSpots, removeSpot } from "@/lib/copies";

/** Übergabeorte: höchstens drei pro Mitglied */
export const GET = route(async () => ({ spots: await listSpots((await requireUser()).id) }));

export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ label: z.string().min(2).max(80), detail: z.string().max(200).nullish(), dropoff: z.boolean().optional() }));
  return { id: await addSpot(u.id, b) };
});

export const DELETE = route(async (req) => {
  const u = await requireUser();
  await removeSpot(u.id, new URL(req.url).searchParams.get("id") ?? "");
  return { ok: true };
});
