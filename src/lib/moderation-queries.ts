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
  const notes = ids("book_note").filter(uuid);
  const [m, c, e, bn] = await Promise.all([
    msg.length ? sql<{ id: string; loan_id: string | null }[]>`select id, loan_id from messages where id = any(${msg}::uuid[])` : [],
    cases.length ? sql<{ id: string; loan_id: string }[]>`select id, loan_id from cases where id = any(${cases}::uuid[])` : [],
    eds.length ? sql<{ id: string; work_id: string }[]>`select id, work_id from editions where id = any(${eds}::uuid[])` : [],
    notes.length ? sql<{ id: string; copy_id: string }[]>`select id, copy_id from book_notes where id = any(${notes}::uuid[])` : [],
  ]);
  // Pinnwand-Zettel haben keinen Link: die Moderation ist kein Mitglied des Kreises, der Text steht in der Meldung
  for (const r of bn) out[`book_note:${r.id}`] = `/exemplar/${r.copy_id}#weg`;
  for (const r of m) if (r.loan_id) out[`message:${r.id}`] = `/moderation/vorgang/${r.loan_id}`;
  for (const r of c) out[`case:${r.id}`] = `/moderation/vorgang/${r.loan_id}`;
  for (const r of e) out[`edition:${r.id}`] = `/titel/${r.work_id}`;
  return out;
}

export type ReportContext = {
  /** der gemeldete Text */
  text: string | null;
  author: string | null;
  author_id: string | null;
  /** Kreis (Pinnwand) oder Buchtitel (Zettel im Buch) */
  where: string | null;
  hidden: boolean;
};

/** Text und Umfeld gemeldeter Pinnwand-Zettel, Kommentare und Zettel im Buch, Schlüssel «typ:id» */
export async function reportContexts(items: { target_type: string; target_id: string }[]): Promise<Record<string, ReportContext>> {
  const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
  const ids = (t: string) => [...new Set(items.filter((i) => i.target_type === t).map((i) => i.target_id))].filter(uuid);
  const posts = ids("circle_post");
  const comments = ids("circle_post_comment");
  const notes = ids("book_note");
  type Row = ReportContext & { id: string };
  const [p, c, n] = await Promise.all([
    posts.length ? sql<Row[]>`
      select p.id, coalesce(p.body, w.title) as text, u.first_name as author, p.author_id, ci.name as "where", p.hidden_at is not null as hidden
        from circle_posts p join users u on u.id = p.author_id join circles ci on ci.id = p.circle_id left join works w on w.id = p.work_id
       where p.id = any(${posts}::uuid[])` : [],
    comments.length ? sql<Row[]>`
      select cm.id, cm.body as text, u.first_name as author, cm.author_id, ci.name as "where", cm.hidden_at is not null as hidden
        from circle_post_comments cm join users u on u.id = cm.author_id
        join circle_posts p on p.id = cm.post_id join circles ci on ci.id = p.circle_id
       where cm.id = any(${comments}::uuid[])` : [],
    notes.length ? sql<Row[]>`
      select n.id, n.body as text, u.first_name as author, n.author_id, e.title as "where", n.hidden_at is not null as hidden
        from book_notes n left join users u on u.id = n.author_id
        join copies cp on cp.id = n.copy_id join editions e on e.id = cp.edition_id
       where n.id = any(${notes}::uuid[])` : [],
  ]);
  const out: Record<string, ReportContext> = {};
  for (const [type, rows] of [["circle_post", p], ["circle_post_comment", c], ["book_note", n]] as const) {
    for (const { id, ...rest } of rows) out[`${type}:${id}`] = rest;
  }
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
