/** Lesende Abfragen für Titelseite und Wunschliste (nur SELECT). */
import { sql } from "@/lib/db";

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export type WorkInfo = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  genre: string | null;
  original_language: string | null;
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
  editions: number;
};

export async function workById(id: string): Promise<WorkInfo | null> {
  if (!isUuid(id)) return null;
  const [w] = await sql<WorkInfo[]>`
    select w.id, w.title, w.subtitle, w.authors, w.genre, w.original_language,
           cv.cover_key, cv.cover_w, cv.cover_h,
           (select count(*)::int from editions e where e.work_id = w.id) as editions
      from works w
      left join lateral (select e.cover_key, e.cover_w, e.cover_h from editions e
                          where e.work_id = w.id and e.cover_key is not null
                          order by e.year desc nulls last limit 1) cv on true
     where w.id = ${id}`;
  return w ?? null;
}

/** Steht das Werk auf der Wunschliste der Person? */
export async function wishFor(userId: string, workId: string) {
  const [r] = await sql<{ radius_km: number; alarm: boolean }[]>`
    select radius_km, alarm from wishlist_items where user_id = ${userId} and work_id = ${workId}`;
  return r ?? null;
}

/** Ein Cover pro Werk (neueste Ausgabe mit Cover) */
export async function coversForWorks(workIds: string[]) {
  if (!workIds.length) return new Map<string, { cover_key: string; cover_w: number | null; cover_h: number | null }>();
  const rows = await sql<{ work_id: string; cover_key: string; cover_w: number | null; cover_h: number | null }[]>`
    select distinct on (e.work_id) e.work_id, e.cover_key, e.cover_w, e.cover_h
      from editions e
     where e.work_id in ${sql(workIds)} and e.cover_key is not null
     order by e.work_id, e.year desc nulls last`;
  return new Map(rows.map((r) => [r.work_id, r]));
}
