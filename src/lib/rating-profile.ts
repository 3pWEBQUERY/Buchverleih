/**
 * Öffentliches Bewertungsprofil: was andere nach abgeschlossenen Leihen zurückgemeldet haben.
 * Nur Bewertungen, die sichtbar sind (beide haben bewertet oder die Frist ist um). Keine Sterne,
 * keine Freitexte (die Notiz ist nur für die Moderation) und keine Buchtitel – sonst wäre
 * öffentlich, was jemand gelesen hat. Getrennt nach Rolle: als verleihende und als leihende Person.
 */
import { sql } from "@/lib/db";

export type RatingReason = "late" | "condition" | "communication" | "no_show";
export type RatingSide = { good: number; problems: number };
export type RatingEntry = {
  verdict: "good" | "problems";
  reasons: RatingReason[];
  /** Erster Tag des Monats, in dem bewertet wurde (genauer muss es öffentlich nicht sein) */
  month: string;
  /** Rolle der bewerteten Person in dieser Leihe */
  role: "lender" | "borrower";
  /** Vorname der bewertenden Person; null, wenn das Konto gelöscht ist */
  from: string | null;
};
export type RatingProfile = {
  total: number;
  good: number;
  problems: number;
  /** Anteil guter Rückmeldungen in Prozent, ab 1 Bewertung */
  goodPct: number | null;
  asLender: RatingSide;
  asBorrower: RatingSide;
  reasons: Record<RatingReason, number>;
  recent: RatingEntry[];
};

export async function ratingProfile(userId: string, limit = 12): Promise<RatingProfile> {
  const rows = await sql<{ verdict: "good" | "problems"; reasons: RatingReason[]; month: string; as_lender: boolean; from_name: string | null }[]>`
    select r.verdict, r.reasons, to_char(date_trunc('month', r.created_at at time zone 'Europe/Zurich'), 'YYYY-MM-DD') as month,
           l.owner_id = r.for_user as as_lender,
           case when f.deleted_at is null then f.first_name end as from_name
      from ratings r
      join loans l on l.id = r.loan_id
      join users f on f.id = r.from_user
     where r.for_user = ${userId} and r.visible_from <= now()
     order by r.created_at desc`;
  const side = (lender: boolean): RatingSide => ({
    good: rows.filter((r) => r.as_lender === lender && r.verdict === "good").length,
    problems: rows.filter((r) => r.as_lender === lender && r.verdict === "problems").length,
  });
  const reasons: Record<RatingReason, number> = { late: 0, condition: 0, communication: 0, no_show: 0 };
  for (const r of rows) for (const x of r.reasons) if (x in reasons) reasons[x]++;
  const good = rows.filter((r) => r.verdict === "good").length;
  return {
    total: rows.length,
    good,
    problems: rows.length - good,
    goodPct: rows.length ? Math.round((100 * good) / rows.length) : null,
    asLender: side(true),
    asBorrower: side(false),
    reasons,
    recent: rows.slice(0, limit).map((r) => ({
      verdict: r.verdict, reasons: r.reasons, month: r.month, role: r.as_lender ? "lender" : "borrower", from: r.from_name,
    })),
  };
}
