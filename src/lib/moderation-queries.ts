/**
 * Lesende Ergänzungen für die Moderationsoberfläche (Links auf Meldungsziele,
 * aktueller Wert bei Katalogkorrekturen). Keine Schreibzugriffe.
 */
import { sql } from "@/lib/db";

/** Ziel einer Meldung oder eines Protokolleintrags als Link in der Moderation */
export async function targetLinks(items: { target_type: string; target_id: string }[]): Promise<Record<string, string>> {
  const ids = (t: string) => [...new Set(items.filter((i) => i.target_type === t).map((i) => i.target_id))];
  const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
  const out: Record<string, string> = {};
  for (const id of ids("user")) out[`user:${id}`] = `/moderation/konto/${id}`;
  for (const id of ids("loan")) out[`loan:${id}`] = `/moderation/vorgang/${id}`;
  for (const id of ids("copy")) out[`copy:${id}`] = `/exemplar/${id}`;
  const msg = ids("message").filter(uuid);
  const cases = ids("case").filter(uuid);
  const eds = ids("edition").filter(uuid);
  const [m, c, e] = await Promise.all([
    msg.length ? sql<{ id: string; loan_id: string | null }[]>`select id, loan_id from messages where id = any(${msg}::uuid[])` : [],
    cases.length ? sql<{ id: string; loan_id: string }[]>`select id, loan_id from cases where id = any(${cases}::uuid[])` : [],
    eds.length ? sql<{ id: string; work_id: string }[]>`select id, work_id from editions where id = any(${eds}::uuid[])` : [],
  ]);
  for (const r of m) if (r.loan_id) out[`message:${r.id}`] = `/moderation/vorgang/${r.loan_id}`;
  for (const r of c) out[`case:${r.id}`] = `/moderation/vorgang/${r.loan_id}`;
  for (const r of e) out[`edition:${r.id}`] = `/titel/${r.work_id}`;
  return out;
}

/** Heutiger Wert der Felder, für die eine Korrektur vorliegt */
export async function correctionCurrent(ids: string[]): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const rows = await sql<{ id: string; field: string; title: string; authors: string[]; publisher: string | null; year: number | null; language: string | null; genre: string | null }[]>`
    select cc.id, cc.field, w.title, w.authors, e.publisher, e.year, e.language, w.genre
      from catalog_corrections cc join editions e on e.id = cc.edition_id join works w on w.id = e.work_id
     where cc.id = any(${ids}::uuid[])`;
  return Object.fromEntries(rows.map((r) => {
    const v: Record<string, string | null> = {
      title: r.title, authors: r.authors.join(", "), publisher: r.publisher, year: r.year ? String(r.year) : null, language: r.language, genre: r.genre,
    };
    return [r.id, v[r.field] ?? null];
  }));
}
