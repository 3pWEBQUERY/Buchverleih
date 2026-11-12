/** Lesende Abfragen für Kreise (PRD 7.5): das gemeinsame Regal mit Status. */
import { sql } from "@/lib/db";

export type CircleShelfCopy = {
  id: string;
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  owner_id: string;
  owner_name: string;
  lent_until: Date | null;
};

export async function circleShelf(circleId: string, viewerId?: string) {
  return sql<CircleShelfCopy[]>`
    select c.id, e.work_id, w.title, w.authors, e.cover_key, c.owner_id, o.first_name as owner_name,
           ph.key as photo_key, ph.width as photo_w, ph.height as photo_h,
           (select l.due_at from loans l where l.copy_id = c.id and l.status in ('active', 'return_reported', 'disputed') limit 1) as lent_until
      from circle_copies cc
      join copies c on c.id = cc.copy_id and c.removed_at is null and cardinality(c.offers) > 0
      join editions e on e.id = c.edition_id
      join works w on w.id = e.work_id
      join users o on o.id = c.owner_id
      left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
     where cc.circle_id = ${circleId}
       and (${viewerId ?? null}::uuid is null or not exists (select 1 from blocks bl
             where (bl.blocker_id = c.owner_id and bl.blocked_id = ${viewerId ?? null}::uuid) or (bl.blocker_id = ${viewerId ?? null}::uuid and bl.blocked_id = c.owner_id)))
     order by c.created_at desc`;
}
