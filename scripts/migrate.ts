/**
 * Versionierte Migrationen (PRD 10.4). Läuft vor dem Start jedes Deployments.
 * Jede Datei wird genau einmal in einer Transaktion ausgeführt.
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
      await sql.begin(async (tx) => {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
