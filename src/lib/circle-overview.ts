/**
 * Kreis auf einen Blick: was neu im Regal steht, welche gesuchten Titel ein Mitglied hat
 * und die eigenen Übergaben der nächsten Tage mit Leuten aus diesem Kreis.
 * Datenschutz: Übergaben nur aus Leihen, an denen die betrachtende Person selbst beteiligt ist.
 */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { wantedInCircle, type CircleWanted } from "@/lib/wishlist";

/** Zeitfenster: neu = in den letzten 14 Tagen erfasst; Übergaben = in den nächsten 7 Tagen (überfällige inklusive) */
export const OVERVIEW_NEW_DAYS = 14;
export const OVERVIEW_NEW_LIMIT = 6;
export const OVERVIEW_HANDOVER_DAYS = 7;

export type OverviewCopy = {
  id: string;
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  cover_color: string | null;
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  photo_color: string | null;
  owner_id: string;
  owner_name: string;
  library: boolean;
  lent_until: Date | null;
  created_at: Date;
};

export type OverviewWanted = {
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  /** wie viele andere Mitglieder den Titel suchen (ohne Namen) */
  count: number;
  /** Exemplar im Kreisregal, das jemand hat */
  copy_id: string;
  owner_id: string;
  owner_name: string;
  /** das Exemplar gehört der betrachtenden Person */
  mine: boolean;
};

export type OverviewHandover = {
  loan_id: string;
  copy_id: string;
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  cover_color: string | null;
  photo_key: string | null;
  photo_color: string | null;
  /** handover: Buch wechselt zur ausleihenden Person; return: Rückgabe */
  kind: "handover" | "return";
  /** Rolle der betrachtenden Person in dieser Leihe */
  role: "owner" | "borrower";
  other_id: string;
  other_name: string;
  /** geplanter Tag (YYYY-MM-DD, Schweizer Zeit): Beginn der Leihe bzw. letzter Leihtag */
  day: string;
};

export type CircleOverview = { new: OverviewCopy[]; wanted: OverviewWanted[]; handovers: OverviewHandover[] };

async function assertActive(circleId: string, viewerId: string) {
  const [m] = await sql`select 1 from circle_members where circle_id = ${circleId} and user_id = ${viewerId} and status = 'active'`;
  if (!m) throw err.notFound("Diesen Kreis gibt es nicht, oder du bist kein Mitglied.");
}

/** Die neuesten Bücher im Kreisregal (gleiche Regeln wie das Kreisregal, dazu Sperren und Sichtbarkeit) */
export async function newInCircle(circleId: string, viewerId: string, limit = OVERVIEW_NEW_LIMIT) {
  return sql<OverviewCopy[]>`
    select c.id, e.work_id, w.title, w.authors, e.cover_key, e.cover_color, c.owner_id, o.first_name as owner_name,
           coalesce(c.library_circle_id = cc.circle_id, false) as library, c.created_at,
           ph.key as photo_key, ph.width as photo_w, ph.height as photo_h, ph.color as photo_color,
           (select l.due_at from loans l where l.copy_id = c.id and l.status in ('active', 'return_reported', 'disputed') limit 1) as lent_until
      from circle_copies cc
      join copies c on c.id = cc.copy_id and c.removed_at is null and cardinality(c.offers) > 0
      join editions e on e.id = c.edition_id
      join works w on w.id = e.work_id
      join users o on o.id = c.owner_id and o.banned_at is null and o.deleted_at is null
      left join lateral (select key, width, height, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
     where cc.circle_id = ${circleId}
       and c.created_at > now() - make_interval(days => ${OVERVIEW_NEW_DAYS})
       and copy_visible_to(c.id, ${viewerId})
     order by c.created_at desc
     limit ${limit}`;
}

/**
 * Gesucht im Kreis, mit Treffer: Titel von der geteilten Wunschliste anderer Mitglieder
 * (wantedInCircle), die ein Mitglied im Kreisregal hat. Pro Titel ein Exemplar, freie zuerst.
 */
export async function wantedMatches(circleId: string, viewerId: string, wanted?: CircleWanted[], limit = 6): Promise<OverviewWanted[]> {
  const list = wanted ?? (await wantedInCircle(circleId, viewerId));
  if (!list.length) return [];
  const works = list.map((w) => w.work_id);
  const copies = await sql<{ work_id: string; copy_id: string; owner_id: string; owner_name: string }[]>`
    select distinct on (e.work_id) e.work_id, c.id as copy_id, c.owner_id, o.first_name as owner_name
      from circle_copies cc
      join copies c on c.id = cc.copy_id and c.removed_at is null and cardinality(c.offers) > 0
      join editions e on e.id = c.edition_id
      join users o on o.id = c.owner_id and o.banned_at is null and o.deleted_at is null
      join circle_members om on om.circle_id = cc.circle_id and om.user_id = c.owner_id and om.status = 'active'
     where cc.circle_id = ${circleId} and e.work_id in ${sql(works)}
       and copy_visible_to(c.id, ${viewerId})
     order by e.work_id,
              exists (select 1 from loans l where l.copy_id = c.id and l.status in ('active', 'return_reported', 'disputed')),
              (c.owner_id = ${viewerId}) desc, c.created_at`;
  const byWork = new Map(copies.map((c) => [c.work_id, c]));
  const out: OverviewWanted[] = [];
  for (const w of list) {
    const c = byWork.get(w.work_id);
    if (!c) continue;
    out.push({ work_id: w.work_id, title: w.title, authors: w.authors, cover_key: w.cover_key, count: w.count, copy_id: c.copy_id, owner_id: c.owner_id, owner_name: c.owner_name, mine: c.owner_id === viewerId });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Eigene Übergaben und Rückgaben der nächsten Tage mit aktiven Mitgliedern dieses Kreises.
 * Nur Leihen, an denen die betrachtende Person beteiligt ist – nie die Leihen anderer.
 */
export async function myUpcomingHandovers(circleId: string, viewerId: string, days = OVERVIEW_HANDOVER_DAYS) {
  return sql<OverviewHandover[]>`
    select * from (
      select l.id as loan_id, c.id as copy_id, e.work_id, w.title, w.authors, e.cover_key, e.cover_color,
             ph.key as photo_key, ph.color as photo_color,
             case when l.status = 'accepted' then 'handover' else 'return' end as kind,
             case when l.owner_id = ${viewerId} then 'owner' else 'borrower' end as role,
             x.id as other_id, x.first_name as other_name,
             to_char(case when l.status = 'accepted' then lower(l.wanted)
                          else ((l.due_at - interval '1 second') at time zone 'Europe/Zurich')::date end, 'YYYY-MM-DD') as day
        from loans l
        join copies c on c.id = l.copy_id
        join editions e on e.id = c.edition_id
        join works w on w.id = e.work_id
        join users x on x.id = case when l.owner_id = ${viewerId} then l.borrower_id else l.owner_id end
                    and x.banned_at is null and x.deleted_at is null
        join circle_members xm on xm.circle_id = ${circleId} and xm.user_id = x.id and xm.status = 'active'
        join circle_members me on me.circle_id = ${circleId} and me.user_id = ${viewerId} and me.status = 'active'
        left join lateral (select key, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
       where (l.owner_id = ${viewerId} or l.borrower_id = ${viewerId}) and l.owner_id <> l.borrower_id
         and not exists (select 1 from blocks bl where (bl.blocker_id = x.id and bl.blocked_id = ${viewerId}) or (bl.blocker_id = ${viewerId} and bl.blocked_id = x.id))
         and ((l.status = 'accepted' and l.handed_over_at is null and lower(l.wanted) <= today_ch() + ${days}::int)
           or (l.status = 'active' and l.due_at is not null
               and ((l.due_at - interval '1 second') at time zone 'Europe/Zurich')::date <= today_ch() + ${days}::int))
    ) t
    order by t.day, t.title
    limit 8`;
}

/** Alles zusammen; `wanted` kann übergeben werden, wenn die Seite die Wunschliste schon geladen hat */
export async function circleOverview(circleId: string, viewerId: string, opts: { wanted?: CircleWanted[] } = {}): Promise<CircleOverview> {
  await assertActive(circleId, viewerId);
  const [fresh, wanted, handovers] = await Promise.all([
    newInCircle(circleId, viewerId),
    wantedMatches(circleId, viewerId, opts.wanted),
    myUpcomingHandovers(circleId, viewerId),
  ]);
  return { new: fresh, wanted, handovers };
}
