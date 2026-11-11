import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addPhoto, removePhoto } from "@/lib/copies";

/** POST /api/v1/copies/:id/photos – hochgeladenes Foto anhängen */
export const POST = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  const b = await body(req, z.object({ uploadId: z.string().uuid() }));
  return { id: await addPhoto(u.id, p.id, b.uploadId) };
});

export const DELETE = route<{ id: string }>(async (req) => {
  const u = await requireUser();
  await removePhoto(u.id, new URL(req.url).searchParams.get("photo") ?? "");
  return { ok: true };
});
