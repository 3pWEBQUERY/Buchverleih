import { z } from "zod";
import { body, isoDay, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addBlock, removeBlock } from "@/lib/copies";

/** POST /api/v1/copies/:id/blocks – Sperrzeit (selbst lesen, Ferien) */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ start: isoDay, end: isoDay, note: z.string().max(80).optional() }));
  return { id: await addBlock(u.id, p.id, b.start, b.end, b.note) };
});

export const DELETE = route<{ id: string }>(async (req) => {
  const u = await requireUser();
  await removeBlock(u.id, Number(new URL(req.url).searchParams.get("block")));
  return { ok: true };
});
