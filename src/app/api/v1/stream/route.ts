import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { assertMember } from "@/lib/chat";

/**
 * GET /api/v1/stream?loan=… oder ?chat=… – Server-Sent Events, gespeist über
 * Postgres LISTEN/NOTIFY (PRD 10.2). Kein WebSocket-Dienst nötig.
 */
export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return new Response(null, { status: 401 });
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

  const enc = new TextEncoder();
  let unlisten: (() => Promise<void>) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("ready", { ok: true });
      const l = await sql.listen("chat", (payload) => {
        try {
          const msg = JSON.parse(payload);
          if ((loan && msg.loan_id === loan) || (chat && msg.handover_chat_id === chat)) send(msg.event ? "loan" : "message", msg);
        } catch {}
      });
      unlisten = l.unlisten;
      ping = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 25_000);
      req.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unlisten?.().catch(() => {});
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unlisten?.().catch(() => {});
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
export const dynamic = "force-dynamic";
