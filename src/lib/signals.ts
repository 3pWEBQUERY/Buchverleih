/**
 * Hinweise auf Mehrfachkonten für die Moderation (PRD 6.4): Konten, die sich vom selben Gerät oder
 * derselben IP-Adresse aus angemeldet haben. Nur Hashes mit geheimem Salz, 90 Tage aufbewahrt.
 * Ein Treffer ist ein Hinweis, kein Beweis (gemeinsamer Haushalt, Mobilfunknetz, Bibliothek).
 */
import { createHash } from "node:crypto";
import { sql } from "@/lib/db";

let pepper: string | null = null;
async function getPepper() {
  if (pepper) return pepper;
  const [r] = await sql<{ value: string }[]>`select value from app_settings where key = 'signal_pepper'`;
  pepper = r?.value ?? "";
  return pepper;
}

const hash = (p: string, kind: string, v: string) => createHash("sha256").update(`${p}:${kind}:${v}`).digest("hex");

export async function recordSignals(userId: string, s: { ip?: string | null; device?: string | null }) {
  const p = await getPepper();
  const rows = [
    s.ip && s.ip !== "unbekannt" ? { kind: "ip", hash: hash(p, "ip", s.ip) } : null,
    s.device ? { kind: "device", hash: hash(p, "device", s.device) } : null,
  ].filter((x): x is { kind: string; hash: string } => Boolean(x));
  for (const r of rows) {
    await sql`insert into account_signals (user_id, kind, hash) values (${userId}, ${r.kind}, ${r.hash})
              on conflict (user_id, kind, hash) do update set last_seen = now()`;
  }
}

export type RelatedAccount = { user_id: string; first_name: string | null; email: string; banned_at: Date | null; created_at: Date; device: boolean; ip: boolean; last_seen: Date };

/** Andere Konten mit gemeinsamem Gerät oder gemeinsamer IP in den letzten 90 Tagen */
export async function relatedAccounts(userId: string) {
  return sql<RelatedAccount[]>`
    select u.id as user_id, u.first_name, u.email, u.banned_at, u.created_at,
           bool_or(o.kind = 'device') as device, bool_or(o.kind = 'ip') as ip, max(o.last_seen) as last_seen
      from account_signals mine
      join account_signals o on o.kind = mine.kind and o.hash = mine.hash and o.user_id <> mine.user_id
      join users u on u.id = o.user_id and u.deleted_at is null
     where mine.user_id = ${userId} and o.last_seen > now() - interval '90 days'
     group by u.id
     order by bool_or(o.kind = 'device') desc, max(o.last_seen) desc
     limit 20`;
}
