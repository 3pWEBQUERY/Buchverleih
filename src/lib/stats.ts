/**
 * Auswertungen (PRD 11.2): Regalstatistik für Fördermitglieder, Kreis-Auswertungen für Organisationen.
 * Nur Leihen (kind = 'lend'), die tatsächlich übergeben wurden.
 */
import { sql } from "@/lib/db";

export type MonthCount = { month: string; n: number };

/** Letzte 12 Monate (inklusive aktueller), auch Monate ohne Leihe */
const months = sql`(select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d)`;

export async function shelfStats(ownerId: string) {
  const [totals] = await sql<{ loans: number; lent_now: number; borrowers: number; days_out: number }[]>`
    select count(*)::int as loans,
           count(*) filter (where status in ('active', 'return_reported', 'disputed'))::int as lent_now,
           count(distinct borrower_id)::int as borrowers,
           coalesce(sum(extract(epoch from coalesce(returned_at, now()) - handed_over_at) / 86400), 0)::int as days_out
      from loans where owner_id = ${ownerId} and kind = 'lend' and handed_over_at is not null`;
  const byMonth = await sql<MonthCount[]>`
    select m.month, count(l.id)::int as n from ${months} m
      left join loans l on l.owner_id = ${ownerId} and l.kind = 'lend' and to_char(l.handed_over_at at time zone 'Europe/Zurich', 'YYYY-MM') = m.month
     group by m.month order by m.month`;
  const books = await sql<{ copy_id: string; title: string; authors: string[]; loans: number; days_out: number; last_at: Date | null }[]>`
    select c.id as copy_id, w.title, w.authors,
           count(l.id)::int as loans,
           coalesce(sum(extract(epoch from coalesce(l.returned_at, now()) - l.handed_over_at) / 86400), 0)::int as days_out,
           max(l.handed_over_at) as last_at
      from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
      left join loans l on l.copy_id = c.id and l.kind = 'lend' and l.handed_over_at is not null
     where c.owner_id = ${ownerId} and c.removed_at is null
     group by c.id, w.title, w.authors
     order by count(l.id) desc, w.title
     limit 200`;
  return { totals, byMonth, books };
}

export async function circleStats(circleId: string) {
  const [totals] = await sql<{ loans_30: number; loans_365: number; active_members: number; members: number; books: number }[]>`
    with circle_loans as (
      select l.* from loans l where l.circle_id = ${circleId} and l.kind = 'lend' and l.handed_over_at is not null
    )
    select (select count(*) from circle_loans where handed_over_at > now() - interval '30 days')::int as loans_30,
           (select count(*) from circle_loans where handed_over_at > now() - interval '365 days')::int as loans_365,
           (select count(distinct u) from (
              select borrower_id as u from circle_loans where handed_over_at > now() - interval '90 days'
              union select owner_id from circle_loans where handed_over_at > now() - interval '90 days') x)::int as active_members,
           (select count(*) from circle_members where circle_id = ${circleId} and status = 'active')::int as members,
           (select count(*) from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null where cc.circle_id = ${circleId})::int as books`;
  const byMonth = await sql<MonthCount[]>`
    select m.month, count(l.id)::int as n from ${months} m
      left join loans l on l.circle_id = ${circleId} and l.kind = 'lend' and to_char(l.handed_over_at at time zone 'Europe/Zurich', 'YYYY-MM') = m.month
     group by m.month order by m.month`;
  const popular = await sql<{ work_id: string; title: string; loans: number }[]>`
    select w.id as work_id, w.title, count(*)::int as loans
      from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id join works w on w.id = e.work_id
     where l.circle_id = ${circleId} and l.kind = 'lend' and l.handed_over_at is not null
     group by w.id, w.title order by count(*) desc, w.title limit 5`;
  return { totals, byMonth, popular };
}

/** CSV des eigenen Regals (Fördermitglieder). Felder in Anführungszeichen, ; als Trenner für Excel (de-CH) */
export async function shelfCsv(ownerId: string) {
  const rows = await sql<{ title: string; authors: string[]; isbn13: string | null; publisher: string | null; year: number | null; condition: number; offers: string[]; visibility: string; loans: number; created_at: Date }[]>`
    select w.title, w.authors, e.isbn13, e.publisher, e.year, c.condition, c.offers::text[] as offers, c.visibility, c.created_at,
           (select count(*)::int from loans l where l.copy_id = c.id and l.kind = 'lend' and l.handed_over_at is not null) as loans
      from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
     where c.owner_id = ${ownerId} and c.removed_at is null order by w.title`;
  // Zellen, die mit = + - @ beginnen, als Text kennzeichnen (CSV-Injection in Tabellenprogrammen)
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["Titel", "Autorschaft", "ISBN", "Verlag", "Jahr", "Zustand", "Angebot", "Sichtbarkeit", "Leihen", "Im Regal seit"];
  const lines = rows.map((r) => [r.title, r.authors.join(", "), r.isbn13, r.publisher, r.year, r.condition, r.offers.join(", "), r.visibility, r.loans, r.created_at.toISOString().slice(0, 10)].map(cell).join(";"));
  return "﻿" + [head.map(cell).join(";"), ...lines].join("\r\n");
}
