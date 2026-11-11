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
        const alarms = await runTitleAlarms();
        const matches = await runSwapMatches();
        const retention = await runRetention();
        await heartbeat("daily", { alarms, matches, ...retention });
        console.log("[daily]", { alarms, matches, ...retention });
      }
    } catch (e) {
      console.error("[scheduler]", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

async function main() {
  console.log(`[worker] gestartet · Fristenlauf alle ${DEADLINE_MINUTES} Min.`);
  await ensureCors();
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
