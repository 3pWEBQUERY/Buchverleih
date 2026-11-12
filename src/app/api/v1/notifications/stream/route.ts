import { getLocale } from "@/lib/i18n/server";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { acquireStream, subscribe } from "@/lib/live";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";

/**
 * GET /api/v1/notifications/stream – Server-Sent Events für die eigenen Benachrichtigungen.
 * Ereignisse: «unread» (Zähler) beim Verbinden und nach jedem «gelesen»,
 * «notification» (Zähler und die neue Benachrichtigung) sobald eine eintrifft.
 */
export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return new Response(null, { status: 401 });
  if (u.banned_at) return new Response(null, { status: 403 });
  const release = acquireStream(u.id);
  if (!release) return new Response(null, { status: 429 });
  const userId = u.id;
  const locale = await getLocale();

  const unread = async () => {
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where user_id = ${userId} and channel = 'app' and read_at is null`;
    return r?.n ?? 0;
  };

  const enc = new TextEncoder();
  let stop: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const cleanup = () => {
    closed = true;
    release();
    if (ping) clearInterval(ping);
    stop?.();
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { cleanup(); }
      };
      try {
        stop = await subscribe("notif", async (payload) => {
          let msg: { user_id?: string; id?: string; op?: string };
          try { msg = JSON.parse(payload); } catch { return; }
          if (msg.user_id !== userId) return;
          try {
            if (msg.op === "new" && msg.id) {
              const [r] = await sql<{ id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; created_at: Date }[]>`
                select id, type, payload, loan_id, created_at from notifications where id = ${msg.id} and user_id = ${userId}`;
              if (!r) return;
              const text = renderNotification(r.type, r.payload ?? {}, locale);
              send("notification", {
                unread: await unread(),
                item: { id: r.id, type: r.type, title: text.title, body: text.body, href: r.loan_id ? `/vorgaenge/${r.loan_id}` : r.payload?.href ?? null, loanId: r.loan_id, createdAt: r.created_at },
              });
            } else {
              send("unread", { unread: await unread() });
            }
          } catch {}
        });
      } catch {
        // Ohne LISTEN fragt der Client weiterhin regelmässig nach
      }
      send("unread", { unread: await unread().catch(() => 0) });
      ping = setInterval(() => { if (!closed) try { controller.enqueue(enc.encode(": ping\n\n")); } catch { cleanup(); } }, 25_000);
      req.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch {}
      });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
export const dynamic = "force-dynamic";
