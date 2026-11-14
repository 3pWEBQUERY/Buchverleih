import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { listShelf } from "@/lib/copies";
import { getCalendars } from "@/lib/calendar-batch";

/** GET /api/v1/copies/calendars – Verleihkalender aller eigenen Exemplare (Regal → Kalender, PRD 4.8) */
export const GET = route(async () => {
  const u = await requireUser();
  const copies = await listShelf(u.id);
  const cals = await getCalendars(sql, copies.map((c) => c.id), u.id);
  return { calendars: Object.fromEntries(cals) };
});
