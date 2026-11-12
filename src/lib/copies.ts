/**
 * Regal und Exemplare (PRD 7.1). Erfassen ohne Formular: Scan, Zustand antippen, fertig.
 * Alle weiteren Angaben haben Standardwerte und sind später änderbar.
 */
import { z } from "zod";
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import type { OfferKind } from "@/lib/loans/machine";

export const copySettingsSchema = z.object({
  condition: z.number().int().min(1).max(4).optional(),
  conditionNote: z.string().max(200).nullable().optional(),
  offers: z.array(z.enum(["lend", "swap", "gift"])).max(3).optional(),
  visibility: z.enum(["all", "proven", "circles"]).optional(),
  loanDays: z.union([z.literal(14), z.literal(28), z.literal(42), z.literal(56)]).optional(),
  autoExtend: z.boolean().optional(),
  maxExtensions: z.number().int().min(0).max(2).optional(),
  horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180)]).optional(),
  bufferDays: z.number().int().min(0).max(7).optional(),
  maxFutureBookings: z.number().int().min(1).max(6).optional(),
  passOn: z.enum(["never", "on_request", "always"]).optional(),
  chainMax: z.number().int().min(1).max(4).optional(),
  dropoffAllowed: z.boolean().optional(),
  precious: z.boolean().optional(),
  circleIds: z.array(z.string().uuid()).optional(),
});
export type CopySettings = z.infer<typeof copySettingsSchema>;

const COLS: Record<string, string> = {
  condition: "condition",
  conditionNote: "condition_note",
  offers: "offers",
  visibility: "visibility",
  loanDays: "loan_days",
  autoExtend: "auto_extend",
  maxExtensions: "max_extensions",
  horizonDays: "horizon_days",
  bufferDays: "buffer_days",
  maxFutureBookings: "max_future_bookings",
  passOn: "pass_on",
  chainMax: "chain_max",
  dropoffAllowed: "dropoff_allowed",
  precious: "precious",
};

function toRow(s: CopySettings) {
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(COLS)) {
    const v = (s as Record<string, unknown>)[k];
    if (v !== undefined) row[col] = k === "offers" ? `{${(v as string[]).join(",")}}` : v;
  }
  return row;
}

async function setCircles(tx: Tx, userId: string, copyId: string, circleIds: string[]) {
  await tx`delete from circle_copies where copy_id = ${copyId}`;
  if (!circleIds.length) return;
  const ok = await tx<{ circle_id: string }[]>`
    select circle_id from circle_members where user_id = ${userId} and status = 'active' and circle_id in ${tx(circleIds)}`;
  for (const c of ok) await tx`insert into circle_copies (circle_id, copy_id) values (${c.circle_id}, ${copyId}) on conflict do nothing`;
}

export async function addCopy(userId: string, editionId: string, s: CopySettings) {
  return sql.begin(async (tx) => {
    const [ed] = await tx<{ id: string }[]>`select id from editions where id = ${editionId}`;
    if (!ed) throw err.notFound("Diese Ausgabe gibt es nicht.");
    // Kreis-Voreinstellungen: Leihfrist und «direkt weitergeben: immer»
    const settings: CopySettings = { offers: ["lend"], condition: 2, ...s };
    if (settings.precious && !s.visibility) settings.visibility = "circles";
    if (s.circleIds?.length && !s.passOn) settings.passOn = "always";
    const row = { owner_id: userId, edition_id: editionId, ...toRow(settings) };
    const [c] = await tx<{ id: string }[]>`insert into copies ${tx(row)} returning id`;
    if (s.circleIds) await setCircles(tx, userId, c.id, s.circleIds);
    return c.id;
  });
}

export async function updateCopy(userId: string, copyId: string, s: CopySettings) {
  return sql.begin(async (tx) => {
    const [own] = await tx<{ id: string; transfer_locked_until: Date | null }[]>`
      select id, transfer_locked_until from copies where id = ${copyId} and owner_id = ${userId} and removed_at is null`;
    if (!own) throw err.notFound("Dieses Buch ist nicht in deinem Regal.");
    if (s.offers && s.offers.some((o) => o !== "lend") && own.transfer_locked_until && own.transfer_locked_until > new Date())
      throw err.conflict("transfer_locked", "Geschenkte Bücher kannst du frühestens 30 Tage nach Erhalt weiterverschenken oder tauschen.");
    const row = toRow(s);
    if (Object.keys(row).length) await tx`update copies set ${tx(row)} where id = ${copyId}`;
    if (s.circleIds) await setCircles(tx, userId, copyId, s.circleIds);
  });
}

export async function bulkUpdate(userId: string, copyIds: string[], s: CopySettings) {
  for (const id of copyIds) await updateCopy(userId, id, s);
}

/** Entfernen ist sofort und lässt sich rückgängig machen (PRD 8.2: keine Bestätigungsdialoge). */
export async function removeCopy(userId: string, copyId: string) {
  return sql.begin(async (tx) => {
    const [open] = await tx<{ n: number }[]>`
      select count(*)::int as n from loans where copy_id = ${copyId}
         and status in ('accepted', 'active', 'return_reported', 'returned', 'disputed')`;
    if (open.n) throw err.conflict("copy_busy", "Dieses Buch ist gerade verliehen oder gebucht. Entfernen geht nach Abschluss der Vorgänge.");
    const r = await tx`update copies set removed_at = now(), removed_reason = 'deleted'
                        where id = ${copyId} and owner_id = ${userId} and removed_at is null returning id`;
    if (!r.length) throw err.notFound();
    // Offene Anfragen verfallen
    const reqs = await tx<{ id: string }[]>`select id from loans where copy_id = ${copyId} and status = 'requested'`;
    for (const q of reqs) {
      await tx`update loans set status = 'withdrawn', closed_at = now() where id = ${q.id}`;
      await tx`insert into loan_events (loan_id, actor_id, action, from_status, to_status, meta)
               values (${q.id}, ${userId}, 'copy_removed', 'requested', 'withdrawn', null)`;
    }
  });
}

export async function restoreCopy(userId: string, copyId: string) {
  const r = await sql`update copies set removed_at = null, removed_reason = null
                       where id = ${copyId} and owner_id = ${userId} and removed_reason = 'deleted' returning id`;
  if (!r.length) throw err.notFound();
}

export async function addPhoto(userId: string, copyId: string, uploadId: string) {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string }[]>`select id from copies where id = ${copyId} and owner_id = ${userId}`;
    if (!c) throw err.notFound();
    const [u] = await tx<{ key: string; width: number | null; height: number | null }[]>`
      select key, width, height from uploads where id = ${uploadId} and user_id = ${userId} and purpose = 'copy_photo' and status <> 'rejected'`;
    if (!u?.key) throw err.invalid("Das Foto ist noch nicht hochgeladen.");
    const [p] = await tx<{ id: string }[]>`
      insert into copy_photos (copy_id, key, width, height, position)
      values (${copyId}, ${u.key}, ${u.width}, ${u.height}, (select coalesce(max(position) + 1, 0) from copy_photos where copy_id = ${copyId}))
      returning id`;
    return p.id;
  });
}

export async function removePhoto(userId: string, photoId: string) {
  await sql`delete from copy_photos p using copies c where p.id = ${photoId} and c.id = p.copy_id and c.owner_id = ${userId}`;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export type ShelfStatus = "lent" | "reserved" | "requested" | "available" | "not_offered" | "paused";

export type ShelfCopy = {
  id: string;
  edition_id: string;
  work_id: string;
  title: string;
  authors: string[];
  condition: number;
  offers: OfferKind[];
  visibility: "all" | "proven" | "circles";
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  cover_key: string | null;
  status: ShelfStatus;
  lent_until: Date | null;
  next_start: string | null;
  open_requests: number;
  loan_id: string | null;
  /** bei laufender Leihe: wer das Buch hat und seit wann – nur für die Besitzerin oder den Besitzer */
  lent_to?: string | null;
  lent_since?: Date | null;
  owner_id: string;
  created_at: Date;
};

const SHELF_SELECT = sql`
  c.id, c.edition_id, e.work_id, w.title, w.authors, c.condition, c.offers, c.visibility, c.owner_id, c.created_at, e.cover_key,
  ph.key as photo_key, ph.width as photo_w, ph.height as photo_h,
  cur.id as loan_id, cur.due_at as lent_until,
  (select lower(b.period)::text from copy_bookings b join loans n on n.id = b.loan_id
    where b.copy_id = c.id and n.status = 'accepted' order by lower(b.period) limit 1) as next_start,
  (select count(*)::int from loans r where r.copy_id = c.id and r.status = 'requested') as open_requests,
  case
    when cur.id is not null then 'lent'
    when exists (select 1 from loans a where a.copy_id = c.id and a.status = 'accepted') then 'reserved'
    when exists (select 1 from loans r where r.copy_id = c.id and r.status = 'requested') then 'requested'
    when o.shelf_paused and cardinality(c.offers) > 0 then 'paused'
    when cardinality(c.offers) = 0 then 'not_offered'
    else 'available'
  end as status`;

const SHELF_FROM = sql`
  copies c
  join editions e on e.id = c.edition_id
  join works w on w.id = e.work_id
  join users o on o.id = c.owner_id
  left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
  left join lateral (select l.id, l.due_at, l.handed_over_at, bu.first_name as borrower_name from loans l join users bu on bu.id = l.borrower_id
                      where l.copy_id = c.id and l.status in ('active', 'return_reported', 'disputed') limit 1) cur on true`;

export async function listShelf(ownerId: string): Promise<ShelfCopy[]> {
  return sql<ShelfCopy[]>`
    select ${SHELF_SELECT}, cur.borrower_name as lent_to, cur.handed_over_at as lent_since from ${SHELF_FROM}
     where c.owner_id = ${ownerId} and c.removed_at is null
     order by c.created_at desc`;
}

/** Öffentliches Regal einer Person, so wie die betrachtende Person es sehen darf */
export async function listVisibleShelf(ownerId: string, viewerId: string | null): Promise<ShelfCopy[]> {
  return sql<ShelfCopy[]>`
    select ${SHELF_SELECT} from ${SHELF_FROM}
     where c.owner_id = ${ownerId} and c.removed_at is null and cardinality(c.offers) > 0
       and copy_visible_to(c.id, ${viewerId}::uuid)
     order by c.created_at desc`;
}

/** Neu eingestellte Bücher im Umkreis – keine algorithmische Endlosliste (PRD 7.3) */
export async function newNearby(viewerId: string | null, origin: { lat: number; lng: number }, radiusKm = 5, limit = 16) {
  return sql<(ShelfCopy & { dist: number; owner_name: string })[]>`
    select ${SHELF_SELECT},
           earth_distance(ll_to_earth(${origin.lat}, ${origin.lng}), ll_to_earth(o.display_lat, o.display_lng)) as dist,
           o.first_name as owner_name
      from ${SHELF_FROM}
     where c.removed_at is null and cardinality(c.offers) > 0
       and copy_visible_to(c.id, ${viewerId}::uuid)
       and (${viewerId}::uuid is null or c.owner_id <> ${viewerId}::uuid)
       and earth_box(ll_to_earth(${origin.lat}, ${origin.lng}), ${radiusKm * 1000}) @> ll_to_earth(o.display_lat, o.display_lng)
       and earth_distance(ll_to_earth(${origin.lat}, ${origin.lng}), ll_to_earth(o.display_lat, o.display_lng)) <= ${radiusKm * 1000}
     order by c.created_at desc
     limit ${limit}`;
}

export type CopyDetail = ShelfCopy & {
  condition_note: string | null;
  loan_days: number;
  auto_extend: boolean;
  max_extensions: number;
  horizon_days: number;
  buffer_days: number;
  max_future_bookings: number;
  pass_on: "never" | "on_request" | "always";
  chain_max: number;
  dropoff_allowed: boolean;
  precious: boolean;
  transfer_locked_until: Date | null;
  isbn13: string | null;
  publisher: string | null;
  year: number | null;
  language: string | null;
  binding: string | null;
  pages: number | null;
  owner_name: string;
  owner_avatar: string | null;
  owner_trust: number;
  owner_municipality: string | null;
  owner_paused: boolean;
  owner_since: Date;
  photos: { id: string; key: string; width: number | null; height: number | null }[];
  circle_ids: string[];
  dist: number | null;
};

export async function copyDetail(copyId: string, viewerId: string | null, origin: { lat: number; lng: number } | null) {
  const [c] = await sql<CopyDetail[]>`
    select ${SHELF_SELECT},
           case when c.owner_id = ${viewerId}::uuid then cur.borrower_name end as lent_to,
           case when c.owner_id = ${viewerId}::uuid then cur.handed_over_at end as lent_since,
           c.condition_note, c.loan_days, c.auto_extend, c.max_extensions, c.horizon_days, c.buffer_days,
           c.max_future_bookings, c.pass_on, c.chain_max, c.dropoff_allowed, c.precious, c.transfer_locked_until,
           e.isbn13, e.publisher, e.year, e.language, e.binding, e.pages,
           o.first_name as owner_name, o.avatar_key as owner_avatar, o.trust_level as owner_trust, o.municipality as owner_municipality,
           o.shelf_paused as owner_paused, o.created_at as owner_since,
           coalesce((select json_agg(json_build_object('id', p.id, 'key', p.key, 'width', p.width, 'height', p.height) order by p.position)
                       from copy_photos p where p.copy_id = c.id), '[]') as photos,
           array(select circle_id from circle_copies where copy_id = c.id) as circle_ids,
           case when ${origin?.lat ?? null}::float8 is null then null
                else earth_distance(ll_to_earth(${origin?.lat ?? null}::float8, ${origin?.lng ?? null}::float8), ll_to_earth(o.display_lat, o.display_lng)) end as dist
      from ${SHELF_FROM}
     where c.id = ${copyId} and (c.removed_at is null or c.owner_id = ${viewerId}::uuid)
       and copy_visible_to(c.id, ${viewerId}::uuid)`;
  return c ?? null;
}

/** Exemplare eines Werks in der Nähe (Titelseite, PRD 8.4) */
export async function copiesOfWork(workId: string, viewerId: string | null, origin: { lat: number; lng: number } | null) {
  return sql<(ShelfCopy & { dist: number | null; owner_name: string; owner_avatar: string | null; owner_trust: number; year: number | null; publisher: string | null; binding: string | null; language: string | null; median_response_seconds: number | null; free_now: boolean; loan_days: number })[]>`
    select ${SHELF_SELECT}, c.loan_days, o.first_name as owner_name, o.avatar_key as owner_avatar, o.trust_level as owner_trust,
           e.year, e.publisher, e.binding, e.language, st.median_response_seconds,
           (not o.shelf_paused and not exists (select 1 from copy_bookings b where b.copy_id = c.id
              and daterange(lower(b.period), upper(b.period) + b.buffer_days) @> today_ch())) as free_now,
           case when ${origin?.lat ?? null}::float8 is null then null
                else earth_distance(ll_to_earth(${origin?.lat ?? null}::float8, ${origin?.lng ?? null}::float8), ll_to_earth(o.display_lat, o.display_lng)) end as dist
      from ${SHELF_FROM}
      left join user_stats st on st.user_id = c.owner_id
     where e.work_id = ${workId} and c.removed_at is null and cardinality(c.offers) > 0
       and copy_visible_to(c.id, ${viewerId}::uuid)
     order by dist nulls last, st.median_response_seconds nulls last`;
}

// ---------------------------------------------------------------------------
// Übergabeorte (4.3) und Sperrzeiten (4.8)
// ---------------------------------------------------------------------------

export async function listSpots(userId: string) {
  return sql<{ id: string; label: string; detail: string | null; dropoff: boolean }[]>`
    select id, label, detail, dropoff from pickup_spots where user_id = ${userId} order by created_at`;
}

export async function addSpot(userId: string, s: { label: string; detail?: string | null; dropoff?: boolean }) {
  const [r] = await sql<{ id: string }[]>`
    insert into pickup_spots (user_id, label, detail, dropoff) values (${userId}, ${s.label.trim()}, ${s.detail?.trim() || null}, ${s.dropoff ?? false})
    returning id`.catch((e) => {
    if (e?.code === "23514") throw err.conflict("spot_limit", "Du kannst höchstens drei Übergabeorte festlegen. Entferne zuerst einen.");
    throw e;
  });
  return r.id;
}

export async function removeSpot(userId: string, id: string) {
  await sql`delete from pickup_spots where id = ${id} and user_id = ${userId}`;
}

export async function addBlock(userId: string, copyId: string, start: string, end: string, note?: string) {
  const [c] = await sql<{ id: string }[]>`select id from copies where id = ${copyId} and owner_id = ${userId}`;
  if (!c) throw err.notFound();
  if (end <= start) throw err.invalid("Das Ende muss nach dem Beginn liegen.");
  const [b] = await sql<{ id: number }[]>`
    insert into copy_bookings (copy_id, period, buffer_days, note) values (${copyId}, daterange(${start}::date, ${end}::date), 0, ${note ?? null})
    returning id`;
  return b.id;
}

export async function removeBlock(userId: string, blockId: number) {
  await sql`delete from copy_bookings b using copies c
             where b.id = ${blockId} and b.loan_id is null and c.id = b.copy_id and c.owner_id = ${userId}
               and (b.note is null or b.note not like 'Tausch %')`;
}

// ---------------------------------------------------------------------------
// Weiterstöbern auf der Exemplarseite
// ---------------------------------------------------------------------------

export type RelatedCopy = ShelfCopy & { dist: number | null; owner_name: string };
export type Related = {
  owner: RelatedCopy[];
  sameWork: RelatedCopy[];
  author: RelatedCopy[];
  genre: RelatedCopy[];
  nearby: RelatedCopy[];
  genreName: string | null;
  authorName: string | null;
};

/**
 * Weitere Bücher rund um ein Exemplar: aus demselben Regal, andere Exemplare desselben Titels,
 * mehr von der Autorin oder dem Autor, dasselbe Genre und Neues in der Nähe.
 * Pro Werk erscheint ein Exemplar (bevorzugt mit Bild, dann das nächste), kein Buch doppelt.
 */
export async function relatedForCopy(copyId: string, viewerId: string | null, viewerOrigin: { lat: number; lng: number } | null): Promise<Related> {
  const empty: Related = { owner: [], sameWork: [], author: [], genre: [], nearby: [], genreName: null, authorName: null };
  const [base] = await sql<{ owner_id: string; work_id: string; genre: string | null; authors: string[]; lat: number | null; lng: number | null }[]>`
    select c.owner_id, e.work_id, w.genre, w.authors, o.display_lat as lat, o.display_lng as lng
      from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
     where c.id = ${copyId}`;
  if (!base) return empty;
  const center = viewerOrigin ?? (base.lat != null && base.lng != null ? { lat: base.lat, lng: base.lng } : null);
  const lat = center?.lat ?? null;
  const lng = center?.lng ?? null;
  const RADIUS = 25_000;
  const distExpr = sql`case when ${lat}::float8 is null then null
    else earth_distance(ll_to_earth(${lat}::float8, ${lng}::float8), ll_to_earth(o.display_lat, o.display_lng)) end`;
  const near = sql`(${lat}::float8 is null or (
      earth_box(ll_to_earth(${lat}::float8, ${lng}::float8), ${RADIUS}) @> ll_to_earth(o.display_lat, o.display_lng)
      and earth_distance(ll_to_earth(${lat}::float8, ${lng}::float8), ll_to_earth(o.display_lat, o.display_lng)) <= ${RADIUS}))`;
  const visible = sql`c.removed_at is null and cardinality(c.offers) > 0 and copy_visible_to(c.id, ${viewerId}::uuid)
    and (${viewerId}::uuid is null or c.owner_id <> ${viewerId}::uuid)`;

  /** Ein Exemplar pro Werk, frei und mit Bild zuerst, dann nach Entfernung */
  const perWork = (where: typeof SHELF_SELECT, order: typeof SHELF_SELECT, limit: number) => sql<RelatedCopy[]>`
    select * from (
      select distinct on (e.work_id) ${SHELF_SELECT}, ${distExpr} as dist, o.first_name as owner_name
        from ${SHELF_FROM}
       where ${visible} and e.work_id <> ${base.work_id} and ${where}
       order by e.work_id, (ph.key is null and e.cover_key is null), ${distExpr} nulls last
    ) t
    order by ${order}
    limit ${limit}`;
  const avail = sql`(t.status <> 'available'), (t.photo_key is null and t.cover_key is null)`;

  const author = base.authors[0] ?? null;
  const ownShelf = viewerId === base.owner_id;
  const [owner, sameWork, byAuthor] = await Promise.all([
    ownShelf ? Promise.resolve([] as RelatedCopy[]) : sql<RelatedCopy[]>`
      select * from (
        select ${SHELF_SELECT}, ${distExpr} as dist, o.first_name as owner_name
          from ${SHELF_FROM}
         where c.owner_id = ${base.owner_id} and c.id <> ${copyId} and c.removed_at is null and cardinality(c.offers) > 0
           and copy_visible_to(c.id, ${viewerId}::uuid)
      ) t
      order by ${avail}, t.created_at desc
      limit 30`,
    sql<RelatedCopy[]>`
      select ${SHELF_SELECT}, ${distExpr} as dist, o.first_name as owner_name
        from ${SHELF_FROM}
       where ${visible} and e.work_id = ${base.work_id} and c.id <> ${copyId}
       order by ${distExpr} nulls last
       limit 20`,
    author ? perWork(sql`${author} = any(w.authors) and ${near}`, sql`${avail}, t.dist nulls last`, 24) : Promise.resolve([] as RelatedCopy[]),
  ]);

  const seen = new Set<string>([base.work_id, ...owner.map((c) => c.work_id), ...byAuthor.map((c) => c.work_id)]);
  const genre = base.genre
    ? (await perWork(sql`w.genre = ${base.genre} and ${near}`, sql`${avail}, t.dist nulls last`, 60)).filter((c) => !seen.has(c.work_id)).slice(0, 24)
    : [];
  genre.forEach((c) => seen.add(c.work_id));
  const nearby = (await perWork(near, sql`t.created_at desc`, 80)).filter((c) => !seen.has(c.work_id)).slice(0, 30);

  return { owner, sameWork, author: byAuthor, genre, nearby, genreName: base.genre, authorName: author };
}
