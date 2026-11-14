/**
 * Daten für die persönliche Startseite: Genres über den ganzen Bestand (aus app_stats, vom Worker
 * aufgefrischt) und «Passt zu deiner Wunschliste» (Tauschtreffer und freie Wunschtitel im Umkreis).
 */
import { sql } from "@/lib/db";
import type { ShelfCopy } from "@/lib/copies";

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------

export type GenreCount = { genre: string; n: number };

const GENRES_KEY = "genres";
/** Läuft kein Worker (lokal, Ausfall), rechnet die erste Anfrage nach dieser Zeit selbst neu */
const GENRES_MAX_AGE_MS = 24 * 3600_000;

/**
 * Zählt die angebotenen Bücher pro Genre über den ganzen Bestand und legt das Ergebnis in app_stats ab.
 * Die Zählung ist teuer und ändert sich langsam: der Worker ruft sie stündlich auf.
 */
export async function refreshGenreStats(): Promise<GenreCount[]> {
  const [r] = await sql<{ value: GenreCount[] }[]>`
    insert into app_stats (key, value, refreshed_at)
    select ${GENRES_KEY}, coalesce(json_agg(json_build_object('genre', genre, 'n', n) order by n desc, genre), '[]')::jsonb, now()
      from (select w.genre, count(*)::int as n
              from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
             where c.removed_at is null and cardinality(c.offers) > 0 and w.genre is not null
             group by w.genre) g
    on conflict (key) do update set value = excluded.value, refreshed_at = excluded.refreshed_at
    returning value`;
  return r.value;
}

/** Gespeicherte Zählung; fehlt die Zeile (frische Datenbank) oder ist sie überaltert, wird einmal gerechnet. */
export async function genreStats(): Promise<GenreCount[]> {
  const [r] = await sql<{ value: GenreCount[]; refreshed_at: Date }[]>`select value, refreshed_at from app_stats where key = ${GENRES_KEY}`;
  if (r && Date.now() - r.refreshed_at.getTime() < GENRES_MAX_AGE_MS) return r.value;
  return refreshGenreStats();
}

/**
 * Häufigste Genres ohne die eigenen Bücher. Die Zählung über den ganzen Bestand kommt aus app_stats
 * (für alle Web-Instanzen dieselbe), nur die eigenen Bücher werden jedes Mal (über den Index auf owner_id) abgezogen.
 */
export async function topGenres(userId: string): Promise<GenreCount[]> {
  const [all, own] = await Promise.all([
    genreStats(),
    sql<GenreCount[]>`
      select w.genre, count(*)::int as n from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
       where c.owner_id = ${userId} and c.removed_at is null and cardinality(c.offers) > 0 and w.genre is not null
       group by w.genre`,
  ]);
  const mine = new Map(own.map((r) => [r.genre, r.n]));
  return all
    .map((r) => ({ genre: r.genre, n: r.n - (mine.get(r.genre) ?? 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.genre.localeCompare(b.genre))
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Passt zu deiner Wunschliste
// ---------------------------------------------------------------------------

/** Passt als Eintrag in eine `BookRow` (BookRowItem) */
export type WishlistMatch = Pick<ShelfCopy, "id" | "work_id" | "title" | "authors" | "photo_key" | "photo_w" | "photo_h" | "photo_color" | "cover_key" | "cover_color"> & {
  href: string;
  /** swap: Tauschtreffer (die Person wünscht sich auch eines meiner Bücher); wishlist: Wunschtitel, heute frei im gewählten Umkreis */
  reason: "wishlist" | "swap";
  owner_name: string;
  /** auf 100 m gerundet, in Kilometern; null ohne eigenen Wohnort */
  distance_km: number | null;
};

type MatchRow = Omit<WishlistMatch, "href" | "reason">;

/**
 * Bücher, die zur eigenen Wunschliste passen: zuerst Tauschtreffer (swap_matches, vom Worker täglich
 * gesucht), dann Wunschtitel, von denen heute ein Exemplar im Umkreis des jeweiligen Wunsches frei ist
 * (gleiche Regeln wie Wunschliste und Titelalarm). Nie eigene Bücher, niemand Blockiertes
 * (copy_visible_to), keine entfernten Exemplare, keine pausierten Regale. Pro Werk ein Buch.
 */
export async function wishlistMatches(userId: string, limit = 6): Promise<WishlistMatch[]> {
  const cols = sql`
    c.id, e.work_id, w.title, w.authors, ph.key as photo_key, ph.width as photo_w, ph.height as photo_h, ph.color as photo_color,
    e.cover_key, e.cover_color, o.first_name as owner_name`;
  const dist = sql`earth_distance(ll_to_earth(me.home_lat, me.home_lng), ll_to_earth(o.display_lat, o.display_lng))`;
  const km = sql`(case when me.home_lat is null or o.display_lat is null then null else greatest(100, round(${dist} / 100) * 100) / 1000 end)::float8 as distance_km`;
  const joins = sql`
    join editions e on e.id = c.edition_id
    join works w on w.id = e.work_id
    join users o on o.id = c.owner_id and not o.shelf_paused
    left join lateral (select key, width, height, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true`;
  const shown = sql`c.removed_at is null and cardinality(c.offers) > 0 and c.owner_id <> me.id and copy_visible_to(c.id, me.id)`;

  const [swaps, wishes] = await Promise.all([
    sql<MatchRow[]>`
      select ${cols}, ${km}
        from users me
        join swap_matches m on (m.user_a = me.id or m.user_b = me.id) and not (me.id = any(m.dismissed_by))
        join copies c on c.id = case when m.user_a = me.id then m.copy_for_a else m.copy_for_b end
        join copies mine on mine.id = case when m.user_a = me.id then m.copy_for_b else m.copy_for_a end and mine.removed_at is null
        ${joins}
       where me.id = ${userId} and ${shown}
       order by m.found_at desc
       limit ${limit * 2}`,
    sql<MatchRow[]>`
      select * from (
        select distinct on (e.work_id) ${cols}, ${km}
          from users me
          join wishlist_items wi on wi.user_id = me.id
          join editions e on e.work_id = wi.work_id
          join copies c on c.edition_id = e.id
          join works w on w.id = e.work_id
          join users o on o.id = c.owner_id and not o.shelf_paused
          left join lateral (select key, width, height, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
         where me.id = ${userId} and me.home_lat is not null and ${shown}
           and ${dist} <= wi.radius_km * 1000
           and not exists (select 1 from copy_bookings b where b.copy_id = c.id
                            and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch())
         order by e.work_id, ${dist}
      ) t
       order by distance_km nulls last, title
       limit ${limit * 2}`,
  ]);

  const seen = new Set<string>();
  const out: WishlistMatch[] = [];
  for (const [reason, rows] of [["swap", swaps], ["wishlist", wishes]] as const) {
    for (const r of rows) {
      if (seen.has(r.work_id) || out.length >= limit) continue;
      seen.add(r.work_id);
      out.push({ ...r, href: `/exemplar/${r.id}`, reason });
    }
  }
  return out;
}
