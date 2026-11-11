import { sql } from "@/lib/db";
import { err } from "@/lib/errors";

/**
 * Feste Zeitfenster in Postgres (PRD 12: Ratenbegrenzung auf Anmeldung, Anfragen, Nachrichten).
 * Kein Redis nötig.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const [row] = await sql<{ hits: number }[]>`
    insert into rate_limits (key, window_start, hits)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set hits = rate_limits.hits + 1
    returning hits`;
  if (row.hits > max) throw err.tooMany();
}
