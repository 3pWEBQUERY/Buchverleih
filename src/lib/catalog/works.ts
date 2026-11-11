import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs";
import { lookupExternal, type CatalogRecord } from "./lookup";
import { normalizeIsbn } from "./isbn";

/**
 * Werk und Ausgabe (PRD 4.1, 7.2). Ausgaben desselben Werks werden über einen
 * normalisierten Schlüssel aus Titel und erstem Autor zusammengefasst.
 */
export function workKey(title: string, authors: string[]) {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const surname = authors[0] ? norm(authors[0]).split(" ").pop() : "";
  return `${norm(title)}|${surname}`;
}

export type Edition = {
  id: string;
  work_id: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  publisher: string | null;
  year: number | null;
  language: string | null;
  binding: string | null;
  pages: number | null;
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
  source: string;
  genre: string | null;
};

const EDITION_SELECT = sql`
  e.id, e.work_id, e.isbn13, e.title, w.authors, e.publisher, e.year, e.language, e.binding, e.pages,
  e.cover_key, e.cover_w, e.cover_h, e.source, w.genre`;

export async function editionById(tx: Tx, id: string): Promise<Edition | null> {
  const [e] = await tx<Edition[]>`select ${EDITION_SELECT} from editions e join works w on w.id = e.work_id where e.id = ${id}`;
  return e ?? null;
}

async function upsertWork(tx: Tx, r: { title: string; subtitle?: string | null; authors: string[]; language?: string | null; genre?: string | null }) {
  const key = workKey(r.title, r.authors);
  const [w] = await tx<{ id: string }[]>`
    insert into works (work_key, title, subtitle, authors, original_language, genre)
    values (${key}, ${r.title}, ${r.subtitle ?? null}, ${r.authors}::text[], ${r.language ?? null}, ${r.genre ?? null})
    on conflict (work_key) do update set genre = coalesce(works.genre, excluded.genre)
    returning id`;
  return w.id;
}

/** ISBN → Ausgabe. Eigene Datenbank zuerst, dann externe Quellen. */
export async function editionByIsbn(raw: string, userId?: string): Promise<Edition | null> {
  const isbn = normalizeIsbn(raw);
  if (!isbn) throw err.invalid("Diese ISBN ist ungültig. Prüfe die Ziffern unter dem Strichcode.");
  const [existing] = await sql<Edition[]>`select ${EDITION_SELECT} from editions e join works w on w.id = e.work_id where e.isbn13 = ${isbn}`;
  if (existing) {
    if (!existing.cover_key) await requestCover(sql, existing.id, isbn);
    return existing;
  }
  const rec = await lookupExternal(isbn, { covers: false });
  if (!rec) return null;
  return saveRecord(rec, userId);
}

async function saveRecord(rec: CatalogRecord, userId?: string) {
  return sql.begin(async (tx) => {
    const workId = await upsertWork(tx, rec);
    const [e] = await tx<{ id: string }[]>`
      insert into editions (work_id, isbn13, title, publisher, year, language, binding, pages, source, created_by)
      values (${workId}, ${rec.isbn13}, ${rec.subtitle ? `${rec.title}. ${rec.subtitle}` : rec.title}, ${rec.publisher ?? null},
              ${rec.year ?? null}, ${rec.language ?? null}, ${rec.binding ?? null}, ${rec.pages ?? null}, ${rec.source}, ${userId ?? null})
      on conflict (isbn13) do update set title = editions.title
      returning id`;
    await requestCover(tx, e.id, rec.isbn13);
    return (await editionById(tx, e.id))!;
  });
}

/** Original-Cover anfordern – höchstens einmal pro Woche und Ausgabe. */
export async function requestCover(tx: Tx, editionId: string, isbn: string) {
  if (!env.covers) return;
  const r = await tx`
    update editions set cover_checked_at = now()
     where id = ${editionId} and cover_key is null
       and (cover_checked_at is null or cover_checked_at < now() - interval '7 days')
    returning id`;
  if (r.length) await enqueue(tx, "cache_cover", { editionId, isbn });
}

/** Bücher ohne ISBN: Titel, Autor, Foto von Hand (PRD 7.1). */
export async function createManualEdition(
  userId: string,
  input: { title: string; authors: string[]; year?: number | null; language?: string | null; publisher?: string | null; genre?: string | null; isbn?: string | null },
) {
  const isbn = input.isbn ? normalizeIsbn(input.isbn) : null;
  if (input.isbn && !isbn) throw err.invalid("Diese ISBN ist ungültig.");
  return sql.begin(async (tx) => {
    if (isbn) {
      const [ex] = await tx<{ id: string }[]>`select id from editions where isbn13 = ${isbn}`;
      if (ex) return (await editionById(tx, ex.id))!;
    }
    const workId = await upsertWork(tx, { title: input.title.trim(), authors: input.authors.map((a) => a.trim()).filter(Boolean), language: input.language, genre: input.genre });
    const [e] = await tx<{ id: string }[]>`
      insert into editions (work_id, isbn13, title, publisher, year, language, source, created_by)
      values (${workId}, ${isbn}, ${input.title.trim()}, ${input.publisher ?? null}, ${input.year ?? null}, ${input.language ?? null}, 'manual', ${userId})
      returning id`;
    if (isbn) await requestCover(tx, e.id, isbn);
    return (await editionById(tx, e.id))!;
  });
}

/** Manuelle Suche: Titel oder Autor tippen, Ausgabe wählen (PRD 7.1). Nur im eigenen Katalog. */
export async function suggestEditions(q: string, limit = 8) {
  const needle = q.trim();
  if (needle.length < 2) return [];
  return sql<Edition[]>`
    select ${EDITION_SELECT}
      from works w join editions e on e.work_id = w.id
     where w.search_vector @@ websearch_to_tsquery('german', f_unaccent(${needle}))
        or lower(f_unaccent(${needle})) <% w.search_text
        or w.search_text like '%' || lower(f_unaccent(${needle})) || '%'
     order by word_similarity(lower(f_unaccent(${needle})), w.search_text) desc, e.year desc nulls last
     limit ${limit}`;
}
