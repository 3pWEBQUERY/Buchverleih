/** Wunschliste, Titelalarm und Tauschtreffer (PRD 4.6, 5.3) */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { entitlements } from "@/lib/trust";
import { notify } from "@/lib/notify";
import { fmtDistance } from "@/lib/geo";

export async function listWishlist(userId: string) {
  return sql<{ work_id: string; title: string; authors: string[]; radius_km: number; alarm: boolean; available_near: number }[]>`
    select w.id as work_id, w.title, w.authors, wi.radius_km, wi.alarm,
           (select count(*)::int from copies c join editions e on e.id = c.edition_id join users o on o.id = c.owner_id
             where e.work_id = w.id and c.removed_at is null and cardinality(c.offers) > 0 and c.owner_id <> ${userId}
               and copy_visible_to(c.id, ${userId})
               and earth_distance(ll_to_earth(me.home_lat, me.home_lng), ll_to_earth(o.display_lat, o.display_lng)) <= wi.radius_km * 1000
               and not exists (select 1 from copy_bookings b where b.copy_id = c.id
                                and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch())) as available_near
      from wishlist_items wi join works w on w.id = wi.work_id join users me on me.id = wi.user_id
     where wi.user_id = ${userId}
     order by wi.created_at desc`;
}

export async function addWish(userId: string, planId: string, workId: string, radiusKm = 5) {
  const e = await entitlements(sql, planId);
  const [c] = await sql<{ n: number }[]>`select count(*)::int as n from wishlist_items where user_id = ${userId} and alarm`;
  if (c.n >= e.title_alarms) throw err.conflict("alarm_limit", `Du kannst bis zu ${e.title_alarms} Titelalarme setzen.`);
  await sql`insert into wishlist_items (user_id, work_id, radius_km) values (${userId}, ${workId}, ${radiusKm})
            on conflict (user_id, work_id) do update set radius_km = excluded.radius_km, alarm = true`;
}

export async function updateWish(userId: string, workId: string, s: { radiusKm?: number; alarm?: boolean }) {
  await sql`update wishlist_items set radius_km = coalesce(${s.radiusKm ?? null}, radius_km), alarm = coalesce(${s.alarm ?? null}, alarm)
             where user_id = ${userId} and work_id = ${workId}`;
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
      join users o on o.id = c.owner_id and not o.shelf_paused
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
      await notify(tx, { userId: h.user_id, type: "title_alarm", data: { title: h.title, text: `Ein Exemplar ist ${fmtDistance(h.dist)} entfernt frei.`, href: `/titel/${h.work_id}` } });
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
       where c.removed_at is null and 'swap' = any(c.offers) and not o.shelf_paused and o.deleted_at is null
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
