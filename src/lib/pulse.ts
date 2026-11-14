/**
 * Puls: «Diese Woche in deinen Kreisen». Nur Aggregiertes oder selbst Veröffentlichtes –
 * nie «X hat Y von Z geliehen».
 */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { listed, notBlocked, type PostKind } from "@/lib/pinboard";

export type PulseCircle = { id: string; name: string };
export type PulseItem =
  /** Übergaben von Büchern aus den Kreisregalen, nur als Zahl */
  | { type: "moved"; count: number }
  /** Jemand hat Bücher ins Kreisregal gestellt (nur mit pulse_show_new_books) */
  | { type: "shelved"; user: { id: string; first_name: string; avatar_key: string | null }; count: number; circle: PulseCircle }
  /** Neue Zettel an der Pinnwand */
  | { type: "post"; post: { id: string; kind: PostKind; text: string | null; first_name: string; circle: PulseCircle; title: string | null; created_at: Date } };

const HANDOVERS = ["handover", "confirm_handover", "handover_report_lapse"];
const EXCERPT = 120;

export async function pulse(userId: string, opts: { circleId?: string | null } = {}): Promise<PulseItem[]> {
  const circles = await sql<PulseCircle[]>`
    select c.id, c.name from circles c join circle_members m on m.circle_id = c.id and m.user_id = ${userId} and m.status = 'active'
     ${opts.circleId ? sql`where c.id = ${opts.circleId}` : sql``}
     order by c.name`;
  if (opts.circleId && !circles.length) throw err.notFound("Diesen Kreis gibt es nicht, oder du bist kein Mitglied.");
  if (!circles.length) return [];
  const ids = circles.map((c) => c.id);

  const [[moved], shelved, posts] = await Promise.all([
    sql<{ n: number }[]>`
      select count(distinct ev.id)::int as n
        from loan_events ev join loans l on l.id = ev.loan_id
       where ev.action in ${sql(HANDOVERS)} and ev.created_at > now() - interval '7 days'
         and (l.circle_id in ${sql(ids)}
              or exists (select 1 from circle_copies cc where cc.copy_id = l.copy_id and cc.circle_id in ${sql(ids)}))`,
    sql<{ user_id: string; first_name: string; avatar_key: string | null; count: number; circle_id: string; circle_name: string }[]>`
      select o.id as user_id, o.first_name, o.avatar_key, count(distinct c.id)::int as count,
             (array_agg(ci.id order by ci.name))[1] as circle_id, min(ci.name) as circle_name
        from circle_copies cc
        join circles ci on ci.id = cc.circle_id
        join copies c on c.id = cc.copy_id and c.removed_at is null and cardinality(c.offers) > 0
        join users o on o.id = c.owner_id and o.pulse_show_new_books and o.banned_at is null and o.deleted_at is null
        join circle_members m on m.circle_id = cc.circle_id and m.user_id = c.owner_id and m.status = 'active'
       where cc.circle_id in ${sql(ids)} and c.created_at > now() - interval '7 days' and c.owner_id <> ${userId}
         and ${notBlocked(sql, userId, sql`c.owner_id`)}
       group by o.id, o.first_name, o.avatar_key
       order by count desc, max(c.created_at) desc
       limit 8`,
    sql<{ id: string; kind: PostKind; text: string | null; first_name: string; circle_id: string; circle_name: string; title: string | null; created_at: Date }[]>`
      select p.id, p.kind, left(p.body, ${EXCERPT}) as text, u.first_name, ci.id as circle_id, ci.name as circle_name, p.created_at,
             coalesce(w.title, (select cw.title from copies pc join editions pe on pe.id = pc.edition_id join works cw on cw.id = pe.work_id where pc.id = p.copy_id)) as title
        from circle_posts p
        join users u on u.id = p.author_id
        join circles ci on ci.id = p.circle_id
        left join works w on w.id = p.work_id
       where p.circle_id in ${sql(ids)} and p.created_at > now() - interval '7 days' and p.author_id <> ${userId}
         and ${listed(sql, userId)}
       order by p.created_at desc
       limit 5`,
  ]);

  const items: PulseItem[] = [];
  if (moved.n > 0) items.push({ type: "moved", count: moved.n });
  for (const s of shelved) {
    items.push({ type: "shelved", user: { id: s.user_id, first_name: s.first_name, avatar_key: s.avatar_key }, count: s.count, circle: { id: s.circle_id, name: s.circle_name } });
  }
  for (const p of posts) {
    items.push({ type: "post", post: { id: p.id, kind: p.kind, text: p.text, first_name: p.first_name, circle: { id: p.circle_id, name: p.circle_name }, title: p.title, created_at: p.created_at } });
  }
  return items;
}
