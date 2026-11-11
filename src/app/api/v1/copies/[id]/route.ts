import { route, body } from "@/lib/api";
import { getUser, requireUser } from "@/lib/auth/session";
import { copyDetail, copySettingsSchema, removeCopy, updateCopy } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";

/** GET /api/v1/copies/:id – Exemplar mit Verleihkalender */
export const GET = route<{ id: string }>(async (_req, p) => {
  const u = await getUser();
  const origin = u?.home_lat != null ? { lat: u.home_lat, lng: u.home_lng! } : null;
  const copy = await copyDetail(p.id, u?.id ?? null, origin);
  if (!copy) throw err.notFound("Dieses Buch ist nicht mehr verfügbar.");
  const calendar = await getCalendar(sql, p.id, u?.id ?? null);
  return { copy, calendar };
});

/** PATCH /api/v1/copies/:id – Einstellungen ändern */
export const PATCH = route<{ id: string }>(async (req, p) => {
  const u = await requireUser();
  await updateCopy(u.id, p.id, await body(req, copySettingsSchema));
  return { ok: true };
});

/** DELETE /api/v1/copies/:id – aus dem Regal nehmen (rückgängig mit POST …/restore) */
export const DELETE = route<{ id: string }>(async (_req, p) => {
  const u = await requireUser();
  await removeCopy(u.id, p.id);
  return { ok: true, undo: `/api/v1/copies/${p.id}/restore` };
});
