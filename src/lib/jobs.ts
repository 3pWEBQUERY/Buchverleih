import type { Tx } from "@/lib/db";

export type JobKind =
  | "send_email"
  | "send_sms"
  | "process_upload"
  | "cache_cover"
  | "fetch_catalog"
  | "seed_demo"
  | "remove_demo";

/** Reiht eine Aufgabe ein – idealerweise in derselben Transaktion wie die auslösende Änderung. */
export async function enqueue(tx: Tx, kind: JobKind, payload: Record<string, unknown>, runAt?: Date) {
  await tx`insert into jobs (kind, payload, run_at)
           values (${kind}, ${tx.json(payload as never)}, ${runAt ?? new Date()})`;
}
