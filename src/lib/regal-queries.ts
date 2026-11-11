/** Lesende Abfragen für «Mein Regal», die listShelf nicht liefert. */
import { sql } from "@/lib/db";

/** Leihfrist je Exemplar – für «Rückgängig» nach einer Mehrfachänderung */
export async function shelfLoanDays(ownerId: string) {
  const rows = await sql<{ id: string; loan_days: number }[]>`
    select id, loan_days from copies where owner_id = ${ownerId} and removed_at is null`;
  return Object.fromEntries(rows.map((r) => [r.id, r.loan_days])) as Record<string, number>;
}
