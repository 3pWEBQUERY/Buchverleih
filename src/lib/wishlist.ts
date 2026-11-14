/** Wunschliste, Titelalarm und Tauschtreffer (PRD 4.6, 5.3) */
import type postgres from "postgres";
import { systemText } from "@/lib/notify/system-texts";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { entitlements } from "@/lib/trust";
import { notify } from "@/lib/notify";

export type WishRow = {
  work_id: string;
  title: string;
  authors: string[];
  radius_km: number;
  alarm: boolean;
  /** Wunsch ist für Mitglieder meiner Kreise sichtbar */
  share_circles: boolean;
  since: string;
  /** Exemplare im Umkreis, frei oder belegt */
  total_near: number;
  /** davon heute frei */
  available_near: number;
  /** nächstes freies Exemplar im Umkreis */
  free_copy: string | null;
  free_dist: number | null;
  free_owner: string | null;
  /** frühester Tag, an dem ein belegtes Exemplar im Umkreis wieder frei ist */
  next_free: string | null;
  /** nächstes Exemplar ausserhalb des Umkreises (Meter) */
  nearest_beyond: number | null;
};

/**
 * Wunschliste mit Verfügbarkeit: wie viele Exemplare im gewählten Umkreis stehen, wie viele heute frei sind,
 * welches freie am nächsten ist, ab wann ein belegtes wieder frei wird und wie weit das nächste ausserhalb liegt.
 */
export async function listWishlist(userId: string) {
  return sql<WishRow[]>`
    with mine as (
      select wi.work_id, wi.radius_km, wi.alarm, wi.share_circles, wi.created_at, me.home_lat, me.home_lng
        from wishlist_items wi join users me on me.id = wi.user_id
       where wi.user_id = ${userId}
    ), cand as (
      select m.work_id, c.id, o.first_name as owner_name, m.radius_km,
             earth_distance(ll_to_earth(m.home_lat, m.home_lng), ll_to_earth(o.display_lat, o.display_lng)) as dist,
             (select max(upper(b.period) + b.buffer_days) from copy_bookings b where b.copy_id = c.id
               and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch()) as busy_until
        from mine m
        join editions e on e.work_id = m.work_id
        join copies c on c.edition_id = e.id
        join users o on o.id = c.owner_id
       where c.removed_at is null and cardinality(c.offers) > 0 and c.owner_id <> ${userId}
         and copy_visible_to(c.id, ${userId})
    )
    select w.id as work_id, w.title, w.authors, m.radius_km, m.alarm, m.share_circles, to_json(m.created_at) #>> '{}' as since,
           (select count(*)::int from cand k where k.work_id = m.work_id and k.dist <= m.radius_km * 1000) as total_near,
           (select count(*)::int from cand k where k.work_id = m.work_id and k.dist <= m.radius_km * 1000 and k.busy_until is null) as available_near,
           -- Entfernungen nur auf 100 m genau herausgeben (Anzeigeort nicht rückrechenbar)
           f.id as free_copy, (case when f.dist is null then null else greatest(100, round(f.dist / 100) * 100) end)::float8 as free_dist, f.owner_name as free_owner,
           (select min(k.busy_until)::text from cand k where k.work_id = m.work_id and k.dist <= m.radius_km * 1000 and k.busy_until is not null) as next_free,
           (select (case when min(k.dist) is null then null else greatest(100, round(min(k.dist) / 100) * 100) end)::float8 from cand k where k.work_id = m.work_id and k.dist > m.radius_km * 1000) as nearest_beyond
      from mine m
      join works w on w.id = m.work_id
      left join lateral (
        select k.id, k.dist, k.owner_name from cand k
         where k.work_id = m.work_id and k.dist <= m.radius_km * 1000 and k.busy_until is null
         order by k.dist limit 1
      ) f on true
     order by m.created_at desc`;
}

export async function addWish(userId: string, planId: string, workId: string, radiusKm = 5, shareCircles?: boolean) {
  const e = await entitlements(sql, planId);
  const [c] = await sql<{ n: number }[]>`select count(*)::int as n from wishlist_items where user_id = ${userId} and alarm`;
  if (c.n >= e.title_alarms) throw err.conflict("alarm_limit", `Du kannst bis zu ${e.title_alarms} Titelalarme setzen.`);
  await sql`insert into wishlist_items (user_id, work_id, radius_km, share_circles) values (${userId}, ${workId}, ${radiusKm}, ${shareCircles ?? false})
            on conflict (user_id, work_id) do update set radius_km = excluded.radius_km, alarm = true,
              share_circles = coalesce(${shareCircles ?? null}::boolean, wishlist_items.share_circles)`;
}

export async function updateWish(userId: string, workId: string, s: { radiusKm?: number; alarm?: boolean; shareCircles?: boolean }) {
  await sql`update wishlist_items set radius_km = coalesce(${s.radiusKm ?? null}, radius_km), alarm = coalesce(${s.alarm ?? null}, alarm),
                   share_circles = coalesce(${s.shareCircles ?? null}::boolean, share_circles)
             where user_id = ${userId} and work_id = ${workId}`;
}

// ---------------------------------------------------------------------------
// Wünsche im Kreis sichtbar (nur mit share_circles, nur unter aktiven Mitgliedern, nie bei Blockierung)
// ---------------------------------------------------------------------------

const unblocked = (a: string, col: postgres.PendingQuery<postgres.Row[]>) => sql`
  not exists (select 1 from blocks bl where (bl.blocker_id = ${col} and bl.blocked_id = ${a}) or (bl.blocker_id = ${a} and bl.blocked_id = ${col}))`;

export type Wisher = { id: string; first_name: string; circle_name: string };

/**
 * Für das eigene Exemplar: wer in meinen Kreisen sucht dieses Buch? Nur für die Besitzerin oder den Besitzer.
 * Die Zahl steht auf der Seite, die Vornamen kommen erst auf ausdrücklichen Wunsch (eigener Endpunkt).
 */
export async function wishersInMyCircles(userId: string, copyId: string): Promise<{ count: number; people: Wisher[] }> {
  const [copy] = await sql<{ work_id: string }[]>`
    select e.work_id from copies c join editions e on e.id = c.edition_id
     where c.id = ${copyId} and c.owner_id = ${userId} and c.removed_at is null`;
  if (!copy) throw err.notFound("Dieses Buch ist nicht in deinem Regal.");
  const people = await sql<Wisher[]>`
    select distinct on (u.id) u.id, u.first_name, ci.name as circle_name
      from wishlist_items wi
      join users u on u.id = wi.user_id and u.deleted_at is null and u.banned_at is null
      join circle_members theirs on theirs.user_id = wi.user_id and theirs.status = 'active'
      join circle_members mine on mine.circle_id = theirs.circle_id and mine.user_id = ${userId} and mine.status = 'active'
      join circles ci on ci.id = theirs.circle_id
     where wi.work_id = ${copy.work_id} and wi.share_circles and wi.user_id <> ${userId}
       and ${unblocked(userId, sql`wi.user_id`)}
     order by u.id, ci.name`;
  people.sort((a, b) => a.first_name.localeCompare(b.first_name, "de"));
  return { count: people.length, people };
}

/** Nur die Zahl (für die Exemplarseite im eigenen Regal) */
export async function wishersCount(userId: string, copyId: string) {
  return (await wishersInMyCircles(userId, copyId)).count;
}

export type CircleHit = {
  work_id: string;
  circle_id: string;
  circle_name: string;
  copy_id: string;
  owner_name: string;
  /** heute frei und Regal nicht pausiert */
  free_now: boolean;
  /** erster freier Tag (JJJJ-MM-TT), null wenn heute frei oder ohne absehbares Ende belegt */
  free_from: string | null;
};

/**
 * Für die Wunschliste: Exemplare meiner Wunschtitel in den Regalen meiner Kreise (nicht die eigenen).
 * Pro Exemplar ein Eintrag; steht es in mehreren meiner Kreise, zählt der alphabetisch erste.
 */
export async function circleHitsForWishlist(userId: string): Promise<CircleHit[]> {
  return sql<CircleHit[]>`
    select * from (
      select distinct on (c.id) e.work_id, ci.id as circle_id, ci.name as circle_name, c.id as copy_id, o.first_name as owner_name,
             (not o.shelf_paused and busy.n = 0) as free_now,
             busy.free_day::text as free_from
        from wishlist_items wi
        join editions e on e.work_id = wi.work_id
        join copies c on c.edition_id = e.id and c.removed_at is null and cardinality(c.offers) > 0 and c.owner_id <> ${userId}
        join users o on o.id = c.owner_id and o.deleted_at is null and o.banned_at is null
        join circle_copies cc on cc.copy_id = c.id
        join circle_members mine on mine.circle_id = cc.circle_id and mine.user_id = ${userId} and mine.status = 'active'
        join circle_members theirs on theirs.circle_id = cc.circle_id and theirs.user_id = c.owner_id and theirs.status = 'active'
        join circles ci on ci.id = cc.circle_id
        cross join lateral (
          select count(*)::int as n, max(upper(b.period) + b.buffer_days) as free_day
            from copy_bookings b
           where b.copy_id = c.id and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch()
        ) busy
       where wi.user_id = ${userId} and ${unblocked(userId, sql`c.owner_id`)}
       order by c.id, ci.name
    ) t
    order by t.work_id, t.free_now desc, t.free_from nulls last, t.circle_name`;
}

export type CircleWanted = {
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
  /** wie viele andere Mitglieder diesen Titel suchen (ohne Namen) */
  count: number;
  /** eigenes Exemplar dieses Werks, falls vorhanden */
  my_copy_id: string | null;
};

/** Brett «Gesucht im Kreis»: geteilte Wünsche der anderen aktiven Mitglieder, ohne Namen */
export async function wantedInCircle(circleId: string, userId: string): Promise<CircleWanted[]> {
  const [m] = await sql`select 1 from circle_members where circle_id = ${circleId} and user_id = ${userId} and status = 'active'`;
  if (!m) throw err.notFound("Diesen Kreis gibt es nicht, oder du bist kein Mitglied.");
  return sql<CircleWanted[]>`
    select w.id as work_id, w.title, w.authors, cv.cover_key, cv.cover_w, cv.cover_h, x.count,
           (select c.id from copies c join editions e on e.id = c.edition_id
             where e.work_id = w.id and c.owner_id = ${userId} and c.removed_at is null
             order by cardinality(c.offers) desc, c.created_at limit 1) as my_copy_id
      from (
        select wi.work_id, count(*)::int as count, max(wi.created_at) as latest
          from wishlist_items wi
          join circle_members cm on cm.user_id = wi.user_id and cm.circle_id = ${circleId} and cm.status = 'active'
          join users u on u.id = wi.user_id and u.deleted_at is null and u.banned_at is null
         where wi.share_circles and wi.user_id <> ${userId} and ${unblocked(userId, sql`wi.user_id`)}
         group by wi.work_id
      ) x
      join works w on w.id = x.work_id
      left join lateral (select e.cover_key, e.cover_w, e.cover_h from editions e
                          where e.work_id = w.id and e.cover_key is not null order by e.year desc nulls last limit 1) cv on true
     order by x.count desc, x.latest desc
     limit 60`;
}

export async function removeWish(userId: string, workId: string) {
  await sql`delete from wishlist_items where user_id = ${userId} and work_id = ${workId}`;
}

/**
 * Titelalarm: Benachrichtigung, sobald irgendein Exemplar im Umkreis verfügbar wird.
 * Läuft täglich im Worker; pro Titel höchstens ein Alarm in 7 Tagen.
 */
export async function runTitleAlarms() {
  const hits = await sql<{ user_id: string; work_id: string; title: string; dist: number }[]>`
    select wi.user_id, wi.work_id, w.title, min(earth_distance(ll_to_earth(me.home_lat, me.home_lng), ll_to_earth(o.display_lat, o.display_lng))) as dist
      from wishlist_items wi
      join works w on w.id = wi.work_id
      join users me on me.id = wi.user_id and me.deleted_at is null and me.home_lat is not null
      join editions e on e.work_id = wi.work_id
      join copies c on c.edition_id = e.id and c.removed_at is null and cardinality(c.offers) > 0 and c.owner_id <> wi.user_id
      join users o on o.id = c.owner_id and not o.shelf_paused and not o.is_demo
     where wi.alarm
       and (wi.last_alerted_at is null or wi.last_alerted_at < now() - interval '7 days')
       and copy_visible_to(c.id, wi.user_id)
       and earth_distance(ll_to_earth(me.home_lat, me.home_lng), ll_to_earth(o.display_lat, o.display_lng)) <= wi.radius_km * 1000
       and not exists (select 1 from copy_bookings b where b.copy_id = c.id
                        and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch())
       and (c.created_at > coalesce(wi.last_alerted_at, wi.created_at) - interval '1 day'
            or exists (select 1 from loans l where l.copy_id = c.id and l.closed_at > coalesce(wi.last_alerted_at, wi.created_at)))
     group by wi.user_id, wi.work_id, w.title`;
  for (const h of hits) {
    await sql.begin(async (tx) => {
      await tx`update wishlist_items set last_alerted_at = now() where user_id = ${h.user_id} and work_id = ${h.work_id}`;
      await notify(tx, { userId: h.user_id, type: "title_alarm", data: { title: h.title, ...systemText("title_alarm_free", { meters: Math.round(h.dist) }), href: `/titel/${h.work_id}` } });
    });
  }
  return hits.length;
}

/**
 * Tauschtreffer: «Jonas hat ein Buch von deiner Wunschliste, und du hast eines von seiner.»
 * Täglich im Hintergrund über Mitglieder im gewählten Umkreis.
 */
export async function runSwapMatches() {
  const rows = await sql<{ user_a: string; user_b: string; copy_for_a: string; copy_for_b: string; title_a: string; name_b: string; name_a: string; title_b: string }[]>`
    with offers as (
      select c.id as copy_id, c.owner_id, e.work_id, w.title, o.display_lat, o.display_lng
        from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
       where c.removed_at is null and 'swap' = any(c.offers) and not o.shelf_paused and o.deleted_at is null and not o.is_demo
         and (c.transfer_locked_until is null or c.transfer_locked_until < now())
    )
    select distinct on (wa.user_id, ob.owner_id)
           wa.user_id as user_a, ob.owner_id as user_b, ob.copy_id as copy_for_a, oa.copy_id as copy_for_b,
           ob.title as title_a, oa.title as title_b, ub.first_name as name_b, ua.first_name as name_a
      from wishlist_items wa
      join users ua on ua.id = wa.user_id and ua.home_lat is not null
      join offers ob on ob.work_id = wa.work_id and ob.owner_id <> wa.user_id
      join users ub on ub.id = ob.owner_id
      join wishlist_items wb on wb.user_id = ob.owner_id
      join offers oa on oa.work_id = wb.work_id and oa.owner_id = wa.user_id
     where wa.user_id < ob.owner_id
       and earth_distance(ll_to_earth(ua.home_lat, ua.home_lng), ll_to_earth(ob.display_lat, ob.display_lng)) <= greatest(wa.radius_km, wb.radius_km) * 1000
       and copy_visible_to(ob.copy_id, wa.user_id) and copy_visible_to(oa.copy_id, ob.owner_id)
       and not exists (select 1 from swap_matches m where m.copy_for_a = ob.copy_id and m.copy_for_b = oa.copy_id)`;
  for (const r of rows) {
    await sql.begin(async (tx) => {
      const ins = await tx`insert into swap_matches (user_a, user_b, copy_for_a, copy_for_b) values (${r.user_a}, ${r.user_b}, ${r.copy_for_a}, ${r.copy_for_b})
                           on conflict do nothing returning id`;
      if (!ins.length) return;
      await notify(tx, { userId: r.user_a, type: "swap_match", data: { name: r.name_b, title: r.title_a, href: `/exemplar/${r.copy_for_a}` } });
      await notify(tx, { userId: r.user_b, type: "swap_match", data: { name: r.name_a, title: r.title_b, href: `/exemplar/${r.copy_for_b}` } });
    });
  }
  return rows.length;
}

export async function mySwapMatches(userId: string) {
  return sql<{ id: string; other_name: string; their_copy: string; their_title: string; my_copy: string; my_title: string; found_at: Date }[]>`
    select m.id,
           case when m.user_a = ${userId} then ub.first_name else ua.first_name end as other_name,
           case when m.user_a = ${userId} then m.copy_for_a else m.copy_for_b end as their_copy,
           case when m.user_a = ${userId} then wa.title else wb.title end as their_title,
           case when m.user_a = ${userId} then m.copy_for_b else m.copy_for_a end as my_copy,
           case when m.user_a = ${userId} then wb.title else wa.title end as my_title,
           m.found_at
      from swap_matches m
      join users ua on ua.id = m.user_a join users ub on ub.id = m.user_b
      join copies ca on ca.id = m.copy_for_a join editions ea on ea.id = ca.edition_id join works wa on wa.id = ea.work_id
      join copies cb on cb.id = m.copy_for_b join editions eb on eb.id = cb.edition_id join works wb on wb.id = eb.work_id
     where (m.user_a = ${userId} or m.user_b = ${userId}) and not (${userId}::uuid = any(m.dismissed_by))
       and ca.removed_at is null and cb.removed_at is null
     order by m.found_at desc limit 20`;
}
