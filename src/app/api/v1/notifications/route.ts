import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { getLocale } from "@/lib/i18n/server";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";

/** GET /api/v1/notifications – Benachrichtigungen in der Web-App */
export const GET = route(async () => {
  const u = await requireUser();
  const l = await getLocale();
  const rows = await sql<{ id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; read_at: Date | null; created_at: Date }[]>`
    select id, type, payload, loan_id, read_at, created_at from notifications
     where user_id = ${u.id} and channel = 'app' order by created_at desc limit 60`;
  return {
    unread: rows.filter((r) => !r.read_at).length,
    items: rows.map((r) => ({ ...r, ...renderNotification(r.type, r.payload, l) })),
  };
});

/** POST /api/v1/notifications – als gelesen markieren ({ ids } oder { all: true }) */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional(), loanId: z.string().uuid().optional() }));
  if (b.all) await sql`update notifications set read_at = now() where user_id = ${u.id} and channel = 'app' and read_at is null`;
  else if (b.loanId) await sql`update notifications set read_at = now() where user_id = ${u.id} and loan_id = ${b.loanId} and read_at is null`;
  else if (b.ids?.length) await sql`update notifications set read_at = now() where user_id = ${u.id} and id in ${sql(b.ids)}`;
  return { ok: true };
});
