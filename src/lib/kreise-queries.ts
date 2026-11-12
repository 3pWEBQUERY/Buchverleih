/** Lesende Abfragen für die Kreisübersicht: Gesichter (Vornamen) und neueste Bücher je Kreis. */
import { sql } from "@/lib/db";

export type CirclePreviewBook = {
  id: string; title: string; author: string; authors: string[]; work_id: string;
  cover_key: string | null; photo_key: string | null; photo_w: number | null; photo_h: number | null;
};
export type CircleStats = { free_now: number; pending: number; active_loans: number; mine: number; new_week: number };
export type CirclePreview = { names: { id: string; name: string; photo: string | null }[]; books: CirclePreviewBook[]; stats: CircleStats };

export async function circlePreviews(circleIds: string[], userId?: string) {
  if (circleIds.length === 0) return {} as Record<string, CirclePreview>;
  const [faces, books, stats] = await Promise.all([
    sql<{ circle_id: string; user_id: string; first_name: string; avatar_key: string | null }[]>`
      select circle_id, user_id, first_name, avatar_key from (
        select m.circle_id, u.id as user_id, u.first_name, u.avatar_key, row_number() over (partition by m.circle_id order by (m.role = 'admin') desc, u.first_name) as n
          from circle_members m join users u on u.id = m.user_id
         where m.circle_id in ${sql(circleIds)} and m.status = 'active'
      ) x where n <= 5`,
    sql<(CirclePreviewBook & { circle_id: string })[]>`
      select circle_id, id, title, authors, coalesce(authors[1], '') as author, work_id, cover_key, photo_key, photo_w, photo_h from (
        select cc.circle_id, c.id, w.title, w.authors, e.work_id, e.cover_key, ph.key as photo_key, ph.width as photo_w, ph.height as photo_h,
               row_number() over (partition by cc.circle_id order by c.created_at desc) as n
          from circle_copies cc
          join copies c on c.id = cc.copy_id and c.removed_at is null
          join editions e on e.id = c.edition_id join works w on w.id = e.work_id
          left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
         where cc.circle_id in ${sql(circleIds)}
      ) x where n <= 10`,
    sql<(CircleStats & { circle_id: string })[]>`
      select ci.id as circle_id,
             (select count(*)::int from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null join users o on o.id = c.owner_id
               where cc.circle_id = ci.id and cardinality(c.offers) > 0 and not o.shelf_paused
                 and not exists (select 1 from copy_bookings b where b.copy_id = c.id
                                  and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch())) as free_now,
             (select count(*)::int from circle_members m where m.circle_id = ci.id and m.status = 'pending') as pending,
             (select count(*)::int from loans l where l.circle_id = ci.id and l.status in ('active', 'return_reported', 'disputed')) as active_loans,
             (select count(*)::int from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null
               where cc.circle_id = ci.id and c.owner_id = ${userId ?? null}::uuid) as mine,
             (select count(*)::int from circle_copies cc join copies c on c.id = cc.copy_id and c.removed_at is null
               where cc.circle_id = ci.id and c.created_at > now() - interval '7 days') as new_week
        from circles ci where ci.id in ${sql(circleIds)}`,
  ]);
  const out: Record<string, CirclePreview> = {};
  for (const id of circleIds) out[id] = { names: [], books: [], stats: { free_now: 0, pending: 0, active_loans: 0, mine: 0, new_week: 0 } };
  for (const f of faces) out[f.circle_id].names.push({ id: f.user_id, name: f.first_name, photo: f.avatar_key });
  for (const { circle_id, ...b } of books) out[circle_id].books.push(b);
  for (const { circle_id, ...st } of stats) out[circle_id].stats = st;
  return out;
}
