import type { Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Vertrauensstufen und Limiten (PRD 4.7). Die Zahlen kommen aus dem Plan des Kontos,
 * nicht aus dem Code (PRD 11.3).
 */
export type Entitlements = {
  limits: Record<string, { concurrent: number; open_requests: number }>;
  title_alarms: number;
  csv_export: boolean;
  shelf_stats: boolean;
};

const cache = new Map<string, { at: number; value: Entitlements }>();

export async function entitlements(tx: Tx, planId: string): Promise<Entitlements> {
  const hit = cache.get(planId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const [row] = await tx<{ entitlements: Entitlements }[]>`select entitlements from plans where id = ${planId}`;
  if (!row) throw new Error(`Plan ${planId} fehlt`);
  cache.set(planId, { at: Date.now(), value: row.entitlements });
  return row.entitlements;
}

export async function limitsFor(tx: Tx, user: Pick<SessionUser, "plan_id" | "trust_level">) {
  const e = await entitlements(tx, user.plan_id);
  return e.limits[String(user.trust_level)] ?? e.limits["0"];
}

export function requirePhone() {
  return process.env.REQUIRE_PHONE !== "false";
}

/** Darf diese Person überhaupt anfragen? Liefert eine Meldung, die sagt, was zu tun ist. */
export async function requestBlocker(tx: Tx, user: SessionUser): Promise<string | null> {
  if (!user.onboarded_at) return "Vervollständige zuerst dein Profil.";
  if (!user.email_verified_at) return "Bestätige zuerst deine E-Mail-Adresse.";
  if (requirePhone() && !user.phone_verified_at)
    return "Bestätige zuerst deine Mobilnummer. Das dauert eine Minute und schützt alle vor Mehrfachkonten.";
  if (user.lending_suspended_at)
    return "Leihen und Tauschen sind wegen eines offenen Falls gesperrt. Sobald der Fall gelöst ist, geht es wieder.";
  const [over] = await tx<{ n: number }[]>`
    select count(*)::int as n from loans
     where borrower_id = ${user.id} and status in ('active', 'disputed') and due_at < now() - interval '7 days'`;
  if (over.n > 0) return "Du hast ein Buch, das seit über 7 Tagen überfällig ist. Nach der Rückgabe kannst du wieder anfragen.";
  return null;
}

export async function assertWithinLimits(tx: Tx, user: SessionUser, inCircle: boolean) {
  const lim = await limitsFor(tx, user);
  const [c] = await tx<{ open_requests: number; concurrent: number }[]>`
    select
      count(*) filter (where status = 'requested')::int as open_requests,
      count(*) filter (where status in ('accepted', 'active', 'return_reported', 'disputed')
                         and kind = 'lend' and circle_id is null)::int as concurrent
      from loans where borrower_id = ${user.id}`;
  if (c.open_requests >= lim.open_requests) {
    throw err.conflict(
      "limit_requests",
      `Du hast ${c.open_requests} offene Anfragen, das ist deine Grenze. Warte auf Antworten oder ziehe eine Anfrage zurück.`,
    );
  }
  if (!inCircle && c.concurrent >= lim.concurrent) {
    throw err.conflict(
      "limit_concurrent",
      `Du hast ${c.concurrent} Leihen bei anderen Mitgliedern laufen oder gebucht. Mit deiner Stufe sind ${lim.concurrent} gleichzeitig möglich. Leihen in Kreisen zählen nicht dazu.`,
    );
  }
}

export async function isBlockedBetween(tx: Tx, a: string, b: string) {
  const [r] = await tx<{ n: number }[]>`
    select count(*)::int as n from blocks
     where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a})`;
  return r.n > 0;
}
