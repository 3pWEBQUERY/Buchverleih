import { sql } from "@/lib/db";
import type { OfferKind } from "@/lib/loans/machine";

/**
 * Suche (PRD 7.3): Titel, Autor, ISBN, fehlertolerant. Sortierung: Nähe zuerst,
 * dann Antwortzeit des Verleihers. Volltext mit deutscher Konfiguration plus pg_trgm.
 */
export type SearchFilters = {
  q?: string;
  radiusKm?: number;
  offer?: OfferKind;
  availableNow?: boolean;
  language?: string;
  genre?: string;
  maxCondition?: number;
  limit?: number;
};

export type Origin = { lat: number; lng: number } | null;

export type WorkHit = {
  work_id: string;
  title: string;
  authors: string[];
  genre: string | null;
  copies: number;
  available_now: number;
  nearest_m: number | null;
  cover: { copy_id: string; photo_key: string | null; photo_w: number | null; photo_h: number | null; cover_key: string | null } | null;
  offers: OfferKind[];
};

export async function searchWorks(viewerId: string | null, origin: Origin, f: SearchFilters): Promise<WorkHit[]> {
  const q = (f.q ?? "").trim();
  const isbn = q.replace(/[^0-9Xx]/g, "");
  const textCond = q
    ? sql`and (
        w.search_vector @@ websearch_to_tsquery('german', f_unaccent(${q}))
        or lower(f_unaccent(${q})) <% w.search_text
        or w.search_text like '%' || lower(f_unaccent(${q})) || '%'
        ${isbn.length >= 10 ? sql`or e.isbn13 = ${isbn}` : sql``}
      )`
    : sql``;
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;
  const radiusM = (f.radiusKm ?? 25) * 1000;

  const rows = await sql<(Omit<WorkHit, "offers"> & { o_lend: boolean; o_swap: boolean; o_gift: boolean })[]>`
    with cand as (
      select c.id as copy_id, c.owner_id, e.work_id, c.offers, c.condition,
             case when ${lat}::float8 is null then null
                  else earth_distance(ll_to_earth(${lat}::float8, ${lng}::float8), ll_to_earth(o.display_lat, o.display_lng)) end as dist,
             (not o.shelf_paused and not exists (
                select 1 from copy_bookings b
                 where b.copy_id = c.id and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch()
             )) as free_now,
             st.median_response_seconds,
             e.cover_key,
             (select p.key from copy_photos p where p.copy_id = c.id order by p.position limit 1) as photo_key,
             (select p.width from copy_photos p where p.copy_id = c.id order by p.position limit 1) as photo_w,
             (select p.height from copy_photos p where p.copy_id = c.id order by p.position limit 1) as photo_h,
             w.title, w.authors, w.genre,
             ${q ? sql`word_similarity(lower(f_unaccent(${q})), w.search_text)` : sql`0`} as score
        from copies c
        join editions e on e.id = c.edition_id
        join works w on w.id = e.work_id
        join users o on o.id = c.owner_id
        left join user_stats st on st.user_id = c.owner_id
       where c.removed_at is null
         and cardinality(c.offers) > 0
         and copy_visible_to(c.id, ${viewerId}::uuid)
         and (${viewerId}::uuid is null or c.owner_id <> ${viewerId}::uuid)
         ${textCond}
         ${f.offer ? sql`and ${f.offer}::offer_kind = any(c.offers)` : sql``}
         ${f.language ? sql`and e.language = ${f.language}` : sql``}
         ${f.genre ? sql`and w.genre = ${f.genre}` : sql``}
         ${f.maxCondition ? sql`and c.condition <= ${f.maxCondition}` : sql``}
    )
    select work_id, title, authors, genre,
           count(*)::int as copies,
           count(*) filter (where free_now)::int as available_now,
           min(dist) as nearest_m,
           (array_agg(json_build_object('copy_id', copy_id, 'photo_key', photo_key, 'photo_w', photo_w, 'photo_h', photo_h, 'cover_key', cover_key)
                      order by (photo_key is null and cover_key is null), (photo_key is null), dist nulls last))[1] as cover,
           bool_or('lend' = any(offers)) as o_lend,
           bool_or('swap' = any(offers)) as o_swap,
           bool_or('gift' = any(offers)) as o_gift
      from cand
     where (${lat}::float8 is null or dist <= ${radiusM})
       ${f.availableNow ? sql`and free_now` : sql``}
     group by work_id, title, authors, genre
     order by ${q ? sql`max(score) desc,` : sql``} min(dist) nulls last, min(median_response_seconds) nulls last, title
     limit ${f.limit ?? 150}`;
  return rows.map(({ o_lend, o_swap, o_gift, ...r }) => ({
    ...r,
    offers: [o_lend && "lend", o_swap && "swap", o_gift && "gift"].filter(Boolean) as OfferKind[],
  }));
}

/** Werke ohne verfügbares Exemplar in der Nähe, für die Wunschliste */
export async function searchCatalog(q: string, limit = 10) {
  const needle = q.trim();
  if (needle.length < 2) return [];
  return sql<{ work_id: string; title: string; authors: string[] }[]>`
    select w.id as work_id, w.title, w.authors from works w
     where w.search_vector @@ websearch_to_tsquery('german', f_unaccent(${needle}))
        or lower(f_unaccent(${needle})) <% w.search_text
     order by word_similarity(lower(f_unaccent(${needle})), w.search_text) desc
     limit ${limit}`;
}

export async function logSearch(userId: string | null, q: string, hits: WorkHit[]) {
  const near = hits.filter((h) => h.available_now > 0 && (h.nearest_m ?? Infinity) <= 5000).length;
  await sql`insert into search_log (user_id, q, hits, available_5km) values (${userId}, ${q.slice(0, 120)}, ${hits.length}, ${near})`;
}
