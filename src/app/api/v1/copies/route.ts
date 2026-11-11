import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addCopy, bulkUpdate, copySettingsSchema, listShelf } from "@/lib/copies";

/** GET /api/v1/copies – mein Regal */
export const GET = route(async () => ({ copies: await listShelf((await requireUser()).id) }));

/** POST /api/v1/copies – Buch ins Regal stellen */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, copySettingsSchema.extend({ editionId: z.string().uuid() }));
  const { editionId, ...settings } = b;
  return { id: await addCopy(u.id, editionId, settings) };
});

/** PATCH /api/v1/copies – Mehrfachauswahl: dieselben Einstellungen für mehrere Bücher */
export const PATCH = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, copySettingsSchema.extend({ ids: z.array(z.string().uuid()).min(1).max(200) }));
  const { ids, ...settings } = b;
  await bulkUpdate(u.id, ids, settings);
  return { ok: true };
});
