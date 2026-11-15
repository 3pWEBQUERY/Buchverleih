import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { acquireStream, subscribe } from "@/lib/live";

/**
 * GET /api/v1/circles/:id/stream – Server-Sent Events für die Pinnwand eines Kreises (nur aktive Mitglieder).
 * Ereignis «post» mit { circle_id, post_id, op }; op ist insert, update, delete (Zettel),
 * reaction oder comment. Die Oberfläche lädt den betroffenen Zettel danach einzeln nach.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response(null, { status: 401 });
  if (u.banned_at) return new Response(null, { status: 403 });
  const { id: circleId } = await ctx.params;
  const userId = u.id;
  const isMember = async () => {
    try {
      const [m] = await sql`select 1 from circle_members where circle_id = ${circleId} and user_id = ${userId} and status = 'active'`;
      return Boolean(m);
    } catch {
      return false;
    }
  };
  if (!(await isMember())) return new Response(null, { status: 404 });

  const release = acquireStream(userId);
  if (!release) return new Response(null, { status: 429 });

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
        stop = await subscribe("circle", (payload) => {
          try {
            const msg = JSON.parse(payload) as { circle_id?: string; post_id?: string; op?: string };
            if (msg.circle_id === circleId) send("post", msg);
          } catch {}
        });
      } catch {
        // Ohne LISTEN bleibt die Verbindung offen; die Seite zeigt dann den Stand vom Laden
      }
      send("ready", { ok: true });
      // Ping nur, solange die Verbindung offen ist; dabei prüfen, ob die Person noch Mitglied ist
      ping = setInterval(async () => {
        if (closed) return;
        if (!(await isMember())) {
          cleanup();
          try { controller.close(); } catch {}
          return;
        }
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { cleanup(); }
      }, 25_000);
      const onAbort = () => {
        cleanup();
        try { controller.close(); } catch {}
      };
      // Brach die Verbindung schon während des Aufbaus ab, sofort aufräumen (sonst liefen Ping und LISTEN weiter)
      if (req.signal.aborted) onAbort();
      else req.signal.addEventListener("abort", onAbort);
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
export const dynamic = "force-dynamic";
