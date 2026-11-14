import { apnsConfigured } from "@/lib/apns";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * GET /api/v1/health – für den Railway-Healthcheck (antwortet 200, solange die Datenbank erreichbar ist).
 * Meldet zusätzlich, ob der Fristenlauf in den letzten 2 Stunden gelaufen ist und ob Jobs endgültig
 * gescheitert sind (PRD 10.4). Mit ?strict=1 antwortet er bei solchen Problemen mit 503 –
 * dafür gedacht, dass ein externer Uptime-Dienst Alarm schlägt.
 */
export async function GET(req: Request) {
  const strict = new URL(req.url).searchParams.get("strict") === "1";
  try {
    const [r] = await sql<{ last: Date | null; dead: number; queued: number }[]>`
      select (select last_run_at from worker_heartbeats where job = 'deadlines') as last,
             (select count(*)::int from jobs where done_at is null and attempts >= 5) as dead,
             (select count(*)::int from jobs where done_at is null and attempts < 5 and run_at < now() - interval '15 minutes') as queued`;
    const stale = !r.last || Date.now() - r.last.getTime() > 2 * 3600_000;
    // Ohne Mailversand oder öffentliche Adresse funktionieren Anmeldung und Links nicht
    const mail = Boolean(env.smtpUrl);
    const appUrl = env.appUrlConfigured;
    const ok = !stale && r.dead === 0 && (!env.production || (mail && appUrl));
    return Response.json(
      { ok: strict ? ok : true, db: true, mailConfigured: mail, apnsConfigured: apnsConfigured(), appUrlConfigured: appUrl, deadlinesLastRun: r.last, deadlinesStale: stale, deadJobs: r.dead, overdueJobs: r.queued },
      { status: strict && !ok ? 503 : 200 },
    );
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
export const dynamic = "force-dynamic";
