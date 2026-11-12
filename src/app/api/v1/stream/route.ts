import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { assertMember } from "@/lib/chat";
import { acquireStream } from "@/lib/live";

/**
 * GET /api/v1/stream?loan=… oder ?chat=… – Server-Sent Events, gespeist über
 * Postgres LISTEN/NOTIFY (PRD 10.2). Kein WebSocket-Dienst nötig.
 */
export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return new Response(null, { status: 401 });
  if (u.banned_at) return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const loan = url.searchParams.get("loan");
  const chat = url.searchParams.get("chat");
  try {
    if (loan) await assertMember({ type: "loan", id: loan }, u.id);
    else if (chat) await assertMember({ type: "handover", id: chat }, u.id);
    else return new Response(null, { status: 400 });
  } catch {
    return new Response(null, { status: 404 });
  }

  const release = acquireStream(u.id);
  if (!release) return new Response(null, { status: 429 });

  const enc = new TextEncoder();
  let closed = false;
  let unlisten: (() => Promise<void>) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { closed = true; }
      };
      send("ready", { ok: true });
      const l = await sql.listen("chat", (payload) => {
        try {
          const msg = JSON.parse(payload);
          if ((loan && msg.loan_id === loan) || (chat && msg.handover_chat_id === chat)) send(msg.event ? "loan" : "message", msg);
        } catch {}
      });
      unlisten = l.unlisten;
      // Ping nur, solange die Verbindung offen ist (sonst wirft enqueue)
      ping = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { closed = true; }
      }, 25_000);
      req.signal.addEventListener("abort", () => {
        closed = true;
        release();
        if (ping) clearInterval(ping);
        unlisten?.().catch(() => {});
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      closed = true;
      release();
      if (ping) clearInterval(ping);
      unlisten?.().catch(() => {});
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
export const dynamic = "force-dynamic";
