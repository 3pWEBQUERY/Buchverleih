/**
 * Versionierte Migrationen (PRD 10.4). Läuft vor dem Start jedes Deployments.
 * Jede Datei wird genau einmal in einer Transaktion ausgeführt.
 * Ausnahme: Beginnt eine Datei mit der Zeile «-- no-transaction», laufen ihre Anweisungen einzeln
 * ohne Transaktion (nötig für CREATE INDEX CONCURRENTLY). Solche Dateien müssen wiederholbar sein
 * («if not exists»), denn bricht eine Anweisung ab, wird die Datei beim nächsten Deploy erneut ausgeführt.
 */
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.resolve(process.cwd(), "db/migrations");

async function main() {
  await sql`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`;
  // Verhindert, dass zwei Deployments gleichzeitig migrieren
  await sql`select pg_advisory_lock(727274)`;
  try {
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const body = await readFile(path.join(dir, file), "utf8");
      process.stdout.write(`migrate ${file} … `);
      if (/^--\s*no-transaction\b/.test(body.trimStart())) {
        await runWithoutTransaction(body);
        await sql`insert into schema_migrations (name) values (${file})`;
        console.log("ok (ohne Transaktion)");
        continue;
      }
      await sql.begin(async (tx) => {
        // Nicht ewig auf Sperren warten (laufende App): lieber abbrechen und den Deploy wiederholen
        await tx`set local lock_timeout = '15s'`;
        await tx`set local statement_timeout = '10min'`;
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      console.log("ok");
    }
  } finally {
    await sql`select pg_advisory_unlock(727274)`;
    await sql.end();
  }
}

/** Anweisungen einzeln ausführen; getrennt an «;» am Zeilenende (keine Funktionskörper mit $$ in solchen Dateien) */
async function runWithoutTransaction(body: string) {
  const statements = body
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  await sql`set lock_timeout = '15s'`;
  await sql`set statement_timeout = '30min'`;
  try {
    for (const st of statements) await sql.unsafe(st);
  } finally {
    await sql`reset lock_timeout`;
    await sql`reset statement_timeout`;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
