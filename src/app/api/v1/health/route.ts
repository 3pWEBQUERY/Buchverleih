import { sql } from "@/lib/db";

/**
 * GET /api/v1/health – für den Railway-Healthcheck.
 * Meldet zusätzlich, ob der Fristenlauf in den letzten 2 Stunden gelaufen ist (PRD 10.4).
 */
export async function GET() {
  try {
    const [r] = await sql<{ last: Date | null }[]>`select (select last_run_at from worker_heartbeats where job = 'deadlines') as last`;
    const stale = !r.last || Date.now() - r.last.getTime() > 2 * 3600_000;
    return Response.json({ ok: true, db: true, deadlinesLastRun: r.last, deadlinesStale: stale });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
export const dynamic = "force-dynamic";
