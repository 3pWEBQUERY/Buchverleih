/**
 * Worker-Dienst auf Railway (PRD 10.1): Fristen, Erinnerungen, Bildvarianten,
 * Katalogabfragen, Titelalarm und Tauschtreffer.
 */
import { sql } from "@/lib/db";
import { ensureCors } from "@/lib/storage";
import { runTitleAlarms, runSwapMatches } from "@/lib/wishlist";
import { runDeadlines, runRetention } from "./deadlines";
import { nextJob, runJob } from "./jobs";

const DEADLINE_MINUTES = Number(process.env.DEADLINE_INTERVAL_MINUTES ?? 10);
let stopping = false;

async function heartbeat(job: string, result: unknown) {
  await sql`insert into worker_heartbeats (job, last_run_at, last_result) values (${job}, now(), ${sql.json(result as never)})
            on conflict (job) do update set last_run_at = now(), last_result = excluded.last_result`;
}

async function lastRun(job: string) {
  const [r] = await sql<{ last_run_at: Date }[]>`select last_run_at from worker_heartbeats where job = ${job}`;
  return r?.last_run_at ?? null;
}

async function jobLoop() {
  while (!stopping) {
    const job = await nextJob().catch((e) => {
      console.error("[worker] queue", e.message);
      return null;
    });
    if (job) await runJob(job);
    else await new Promise((r) => setTimeout(r, 1500));
  }
}

async function scheduler() {
  while (!stopping) {
    try {
      const last = await lastRun("deadlines");
      if (!last || Date.now() - last.getTime() >= DEADLINE_MINUTES * 60_000) {
        const r = await runDeadlines();
        if (Object.keys(r).length) console.log("[deadlines]", JSON.stringify(r));
      }
      // Täglicher Lauf für Titelalarm, Tauschtreffer und Aufbewahrung
      const daily = await lastRun("daily");
      if (!daily || Date.now() - daily.getTime() >= 24 * 3600_000) {
        const covers = await backfillCovers();
        const alarms = await runTitleAlarms();
        const matches = await runSwapMatches();
        const retention = await runRetention();
        await heartbeat("daily", { alarms, matches, covers, ...retention });
        console.log("[daily]", { alarms, matches, covers, ...retention });
      }
    } catch (e) {
      console.error("[scheduler]", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

/** Fehlende Original-Cover nachladen (bestehende Ausgaben mit ISBN) */
async function backfillCovers() {
  if (process.env.COVERS === "false") return 0;
  const rows = await sql<{ id: string; isbn13: string }[]>`
    update editions set cover_checked_at = now()
     where id in (select id from editions where isbn13 is not null and cover_key is null
                   and (cover_checked_at is null or cover_checked_at < now() - interval '7 days') limit 300)
    returning id, isbn13`;
  for (const r of rows) {
    await sql`insert into jobs (kind, payload) values ('cache_cover', ${sql.json({ editionId: r.id, isbn: r.isbn13 })})`;
  }
  return rows.length;
}

async function main() {
  console.log(`[worker] gestartet · Fristenlauf alle ${DEADLINE_MINUTES} Min.`);
  await ensureCors();
  const queued = await backfillCovers().catch(() => 0);
  if (queued) console.log(`[covers] ${queued} Cover zum Nachladen eingereiht`);
  await Promise.all([jobLoop(), scheduler()]);
}

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    stopping = true;
    console.log("[worker] beendet");
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
