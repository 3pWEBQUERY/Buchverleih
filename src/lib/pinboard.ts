/**
 * Pinnwand im Kreis: drei strukturierte Zetteltypen (Suche, Empfehlung, Ankündigung),
 * zwei Reaktionen, Kommentare auf einer Ebene. Kein freier Chat.
 * «Ich hab's» ist ein Angebot an die suchende Person; die Anfrage selbst läuft danach
 * ganz normal über die Zustandsmaschine (kein Sonderweg).
 */
import type postgres from "postgres";
import { sql, type Tx } from "@/lib/db";
import { err, AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { systemText } from "@/lib/notify/system-texts";
import { icsText, looksCommercial } from "@/lib/chat";
import { addWish } from "@/lib/wishlist";
import type { ShelfStatus } from "@/lib/copies";

export const POST_KINDS = ["search", "recommend", "announce"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const REACTION_KINDS = ["thanks", "want"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Zettel verschwinden nach 60 Tagen aus der Ansicht (die Zeilen bleiben) */
export const POST_TTL_DAYS = 60;
export const POST_TEXT_MAX = { search: 280, recommend: 280, announce: 500 } as const;
export const COMMENT_MAX = 500;
const COMMENTS_PER_POST = 50;

export type PinAuthor = { id: string; first_name: string; avatar_key: string | null };
export type PinWork = { id: string; title: string; authors: string[]; cover_key: string | null };
/** Exemplar einer Empfehlung, Feldnamen wie ShelfCopy; Status und «verliehen bis» sind live */
export type PinCopy = {
  id: string;
  work_id: string;
  title: string;
  authors: string[];
  cover_key: string | null;
  photo_key: string | null;
  photo_w: number | null;
  photo_h: number | null;
  owner_id: string;
  status: ShelfStatus;
  lent_until: Date | null;
};
export type PinReactions = { thanks: number; want: number; mine: { thanks: boolean; want: boolean } };
export type PinComment = { id: string; author: PinAuthor; body: string; created_at: Date; canDelete: boolean };
export type PinPost = {
  id: string;
  circle_id: string;
  kind: PostKind;
  author: PinAuthor;
  mine: boolean;
  text: string | null;
  created_at: Date;
  /** Suche: das gesuchte Werk. Empfehlung: das Werk des Exemplars. */
  work: PinWork | null;
  /** nur Empfehlung */
  copy: PinCopy | null;
  needed_by: string | null;
  fulfilled_at: Date | null;
  event_at: Date | null;
  event_place: string | null;
  /** Ankündigung mit Termin: Pfad der Kalenderdatei unter /api/v1 */
  ics: string | null;
  reactions: PinReactions;
  comments: PinComment[];
  /** Anzahl sichtbarer Kommentare (comments ist auf die ersten 50 begrenzt) */
  comment_count: number;
  canDelete: boolean;
  /** Suche fremder Personen: meine Exemplare dieses Werks («Ich hab's») */
  myMatchingCopies: { id: string; title: string; lendable: boolean }[];
  offeredByMe: boolean;
  /** nur für die suchende Person: wie viele Angebote schon da sind */
  offers: number;
};
export type PinboardPage = { posts: PinPost[]; nextBefore: string | null; role: "admin" | "member" };

export type PostInput =
  | { kind: "search"; workId: string; neededBy?: string | null; text?: string | null }
  | { kind: "recommend"; copyId: string; text: string }
  | { kind: "announce"; text: string; eventAt?: string | null; eventPlace?: string | null };

const NO_CIRCLE = "Diesen Kreis gibt es nicht, oder du bist kein Mitglied.";
const NO_POST = "Diesen Zettel gibt es nicht mehr.";
export const pinboardHref = (circleId: string) => `/kreise/${circleId}#pinnwand`;

/** Gesperrte oder gelöschte Konten schreiben nichts – auch wenn die Sitzung noch offen wäre */
async function assertActive(tx: Tx, userId: string) {
  const [u] = await tx<{ banned_at: Date | null; deleted_at: Date | null; first_name: string; plan_id: string }[]>`
    select banned_at, deleted_at, first_name, plan_id from users where id = ${userId}`;
  if (!u || u.deleted_at) throw err.unauthorized();
  if (u.banned_at) throw err.forbidden("Dein Konto ist gesperrt. Antworte auf die E-Mail der Moderation, um das zu klären.");
  return u;
}

/** Rolle im Kreis; wer kein aktives Mitglied ist, erfährt nicht einmal, ob es den Kreis gibt */
export async function memberRole(tx: Tx, circleId: string, userId: string): Promise<"admin" | "member"> {
  const [m] = await tx<{ role: "admin" | "member" }[]>`
    select role from circle_members where circle_id = ${circleId} and user_id = ${userId} and status = 'active'`;
  if (!m) throw err.notFound(NO_CIRCLE);
  return m.role;
}

/** Keine Blockierung zwischen der betrachtenden Person und der Person in `col` */
type Fragment = postgres.PendingQuery<postgres.Row[]>;
export const notBlocked = (q: Tx, viewer: string, col: Fragment): Fragment => q`
  not exists (select 1 from blocks bl
               where (bl.blocker_id = ${col} and bl.blocked_id = ${viewer}) or (bl.blocker_id = ${viewer} and bl.blocked_id = ${col}))`;

/**
 * Was in der Ansicht steht (Aliasse: p = circle_posts, u = Autorin): nicht ausgeblendet, jünger als 60 Tage,
 * Suche nicht erfüllt, Empfehlung noch im Kreisregal, Autorin weiter aktives Mitglied, keine Blockierung.
 */
export const listed = (q: Tx, viewer: string): Fragment => q`
  p.hidden_at is null
  and p.created_at > now() - make_interval(days => ${POST_TTL_DAYS})
  and (p.kind <> 'search' or p.fulfilled_at is null)
  and (p.kind <> 'recommend' or exists (
        select 1 from circle_copies cc join copies rc on rc.id = cc.copy_id
         where cc.circle_id = p.circle_id and cc.copy_id = p.copy_id and rc.removed_at is null and rc.owner_id = p.author_id))
  and u.banned_at is null and u.deleted_at is null
  and exists (select 1 from circle_members am where am.circle_id = p.circle_id and am.user_id = p.author_id and am.status = 'active')
  and ${notBlocked(q, viewer, q`p.author_id`)}`;

type PostRef = {
  id: string; circle_id: string; circle_name: string; author_id: string; kind: PostKind;
  work_id: string | null; copy_id: string | null; my_role: "admin" | "member";
};

/** Zettel, so wie ihn diese Person gerade sehen darf – sonst «nicht gefunden» */
async function visiblePost(tx: Tx, postId: string, userId: string): Promise<PostRef> {
  const [p] = await tx<PostRef[]>`
    select p.id, p.circle_id, ci.name as circle_name, p.author_id, p.kind, p.work_id, p.copy_id, m.role as my_role
      from circle_posts p
      join circles ci on ci.id = p.circle_id
      join circle_members m on m.circle_id = p.circle_id and m.user_id = ${userId} and m.status = 'active'
      join users u on u.id = p.author_id
     where p.id = ${postId} and ${listed(tx, userId)}`;
  if (!p) throw err.notFound(NO_POST);
  return p;
}

/** Für Endpunkte mit Kreis im Pfad: der Zettel muss zu genau diesem Kreis gehören */
export async function assertPostInCircle(postId: string, circleId: string) {
  const [p] = await sql`select 1 from circle_posts where id = ${postId} and circle_id = ${circleId}`;
  if (!p) throw err.notFound(NO_POST);
}

function cleanText(raw: string | null | undefined, max: number, required: boolean) {
  const text = raw?.trim() || null;
  if (!text && required) throw err.invalid("Schreib einen Satz dazu.");
  if (text && text.length > max) throw err.invalid(max === 280 ? "Der Text darf höchstens 280 Zeichen lang sein." : "Der Text darf höchstens 500 Zeichen lang sein.");
  return text;
}

async function flag(tx: Tx, targetType: "circle_post" | "circle_post_comment", id: string) {
  await tx`insert into reports (reporter_id, target_type, target_id, reason, note)
           values (null, ${targetType}, ${id}, 'price_pattern', 'Automatisch markiert')`;
}

// ---------------------------------------------------------------------------
// Zettel
// ---------------------------------------------------------------------------

export async function createPost(userId: string, circleId: string, input: PostInput) {
  await rateLimit(`pin:${userId}`, 10, 3600);
  return sql.begin(async (tx) => {
    const me = await assertActive(tx, userId);
    const role = await memberRole(tx, circleId, userId);
    const text = cleanText(input.text, POST_TEXT_MAX[input.kind], input.kind !== "search");
    const row: Record<string, unknown> = { circle_id: circleId, author_id: userId, kind: input.kind, body: text };
    let title: string | null = null;

    if (input.kind === "search") {
      const [w] = await tx<{ id: string; title: string }[]>`select id, title from works where id = ${input.workId}`;
      if (!w) throw err.notFound("Diesen Titel gibt es nicht.");
      if (input.neededBy) {
        const [d] = await tx<{ past: boolean }[]>`select ${input.neededBy}::date < today_ch() as past`;
        if (d.past) throw err.invalid("Das Datum liegt in der Vergangenheit.");
      }
      const [dup] = await tx`
        select 1 from circle_posts p
         where p.circle_id = ${circleId} and p.author_id = ${userId} and p.kind = 'search' and p.work_id = ${w.id}
           and p.fulfilled_at is null and p.hidden_at is null and p.created_at > now() - make_interval(days => ${POST_TTL_DAYS})`;
      if (dup) throw err.conflict("duplicate_search", "Du suchst diesen Titel in diesem Kreis schon.");
      row.work_id = w.id;
      row.needed_by = input.neededBy ?? null;
      title = w.title;
    } else if (input.kind === "recommend") {
      // Nur eigene Exemplare, die im Regal genau dieses Kreises stehen
      const [c] = await tx<{ id: string; title: string }[]>`
        select c.id, w.title
          from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
          join circle_copies cc on cc.copy_id = c.id and cc.circle_id = ${circleId}
         where c.id = ${input.copyId} and c.owner_id = ${userId} and c.removed_at is null
           for update of c`;
      if (!c) throw err.invalid("Empfehlen kannst du nur eigene Bücher aus dem Regal dieses Kreises.");
      row.copy_id = c.id;
      title = c.title;
    } else {
      if (role !== "admin") throw err.forbidden("Ankündigungen schreiben nur Admins des Kreises.");
      const place = input.eventPlace?.trim() || null;
      if (place && place.length > 120) throw err.invalid("Der Ort darf höchstens 120 Zeichen lang sein.");
      row.event_at = input.eventAt ?? null;
      row.event_place = place;
    }

    const flagged = text ? looksCommercial(text) : false;
    row.flagged = flagged;
    const [post] = await tx<{ id: string }[]>`insert into circle_posts ${tx(row)} returning id`;
    if (flagged) await flag(tx, "circle_post", post.id);

    // Neue Zettel melden wir nur Mitgliedern, die das ausdrücklich wollen («all»)
    const [circle] = await tx<{ name: string }[]>`select name from circles where id = ${circleId}`;
    const listeners = await tx<{ user_id: string }[]>`
      select m.user_id from circle_members m join users x on x.id = m.user_id
       where m.circle_id = ${circleId} and m.status = 'active' and m.user_id <> ${userId}
         and x.pinboard_notify = 'all' and x.banned_at is null and x.deleted_at is null
         and ${notBlocked(tx, userId, tx`m.user_id`)}`;
    const what = input.kind === "search" ? systemText("pin_search", { title: title! })
      : input.kind === "recommend" ? systemText("pin_recommend", { title: title! })
      : { text: text!.slice(0, 140) };
    for (const l of listeners) {
      await notify(tx, { userId: l.user_id, type: "circle_post_new", data: { name: me.first_name, circle: circle.name, ...what, href: pinboardHref(circleId) } });
    }
    return post.id;
  });
}

/** Suche als erfüllt markieren (oder die Markierung zurücknehmen) – nur die suchende Person */
export async function setFulfilled(userId: string, postId: string, fulfilled: boolean) {
  const rows = await sql`
    update circle_posts set fulfilled_at = ${fulfilled ? sql`coalesce(fulfilled_at, now())` : null}
     where id = ${postId} and author_id = ${userId} and kind = 'search' and hidden_at is null
       and exists (select 1 from circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = ${userId} and m.status = 'active')
    returning id`;
  if (!rows.length) throw err.notFound(NO_POST);
}

/** Eigene Zettel löschen; Admins des Kreises entfernen jeden Zettel */
export async function deletePost(userId: string, postId: string) {
  const [p] = await sql<{ author_id: string; my_role: string }[]>`
    select p.author_id, m.role as my_role from circle_posts p
      join circle_members m on m.circle_id = p.circle_id and m.user_id = ${userId} and m.status = 'active'
     where p.id = ${postId}`;
  if (!p) throw err.notFound(NO_POST);
  if (p.author_id !== userId && p.my_role !== "admin") throw err.forbidden("Zettel anderer entfernen nur Admins des Kreises.");
  await sql`delete from circle_posts where id = ${postId}`;
}

// ---------------------------------------------------------------------------
// Reaktionen: «Danke» und «Will ich auch lesen»
// ---------------------------------------------------------------------------

async function reactionState(tx: Tx, postId: string, userId: string): Promise<PinReactions> {
  const [r] = await tx<{ thanks: number; want: number; my_thanks: boolean; my_want: boolean }[]>`
    select count(*) filter (where r.kind = 'thanks')::int as thanks,
           count(*) filter (where r.kind = 'want')::int as want,
           coalesce(bool_or(r.kind = 'thanks' and r.user_id = ${userId}), false) as my_thanks,
           coalesce(bool_or(r.kind = 'want' and r.user_id = ${userId}), false) as my_want
      from circle_post_reactions r
     where r.post_id = ${postId} and ${notBlocked(tx, userId, tx`r.user_id`)}`;
  return { thanks: r.thanks, want: r.want, mine: { thanks: r.my_thanks, want: r.my_want } };
}

/**
 * Reaktion setzen (idempotent). «want» mit addToWishlist legt den Titel zusätzlich auf die
 * eigene Wunschliste; steht er schon dort, bleibt der Eintrag unverändert.
 */
export async function react(userId: string, postId: string, kind: ReactionKind, opts: { addToWishlist?: boolean } = {}) {
  await rateLimit(`pinreact:${userId}`, 120, 3600);
  const out = await sql.begin(async (tx) => {
    const me = await assertActive(tx, userId);
    const p = await visiblePost(tx, postId, userId);
    const fresh = await tx`insert into circle_post_reactions (post_id, user_id, kind) values (${postId}, ${userId}, ${kind})
                           on conflict do nothing returning 1`;
    if (fresh.length && p.author_id !== userId) {
      await notify(tx, {
        userId: p.author_id, type: "circle_post_reply",
        data: { name: me.first_name, circle: p.circle_name, ...systemText(kind === "thanks" ? "pin_thanks" : "pin_want"), href: pinboardHref(p.circle_id) },
      });
    }
    let workId = p.work_id;
    if (!workId && p.copy_id) {
      const [w] = await tx<{ work_id: string }[]>`select e.work_id from copies c join editions e on e.id = c.edition_id where c.id = ${p.copy_id}`;
      workId = w?.work_id ?? null;
    }
    return { reactions: await reactionState(tx, postId, userId), workId, planId: me.plan_id };
  });

  let wishlisted = false;
  if (kind === "want" && opts.addToWishlist && out.workId) {
    const [has] = await sql`select 1 from wishlist_items where user_id = ${userId} and work_id = ${out.workId}`;
    if (has) wishlisted = true;
    else {
      try {
        await addWish(userId, out.planId, out.workId);
        wishlisted = true;
      } catch (e) {
        // Grenze der Titelalarme erreicht: die Reaktion zählt trotzdem
        if (!(e instanceof AppError && e.code === "alarm_limit")) throw e;
      }
    }
  }
  return { reactions: out.reactions, wishlisted };
}

export async function unreact(userId: string, postId: string, kind: ReactionKind) {
  return sql.begin(async (tx) => {
    await visiblePost(tx, postId, userId);
    await tx`delete from circle_post_reactions where post_id = ${postId} and user_id = ${userId} and kind = ${kind}`;
    return { reactions: await reactionState(tx, postId, userId) };
  });
}

// ---------------------------------------------------------------------------
// Kommentare (eine Ebene)
// ---------------------------------------------------------------------------

export async function addComment(userId: string, postId: string, raw: string) {
  await rateLimit(`pincomment:${userId}`, 30, 600);
  const body = raw.trim();
  if (!body) throw err.invalid("Der Kommentar ist leer.");
  if (body.length > COMMENT_MAX) throw err.invalid("Der Kommentar darf höchstens 500 Zeichen lang sein.");
  return sql.begin(async (tx) => {
    const me = await assertActive(tx, userId);
    const p = await visiblePost(tx, postId, userId);
    const flagged = looksCommercial(body);
    const [c] = await tx<{ id: string }[]>`
      insert into circle_post_comments (post_id, author_id, body, flagged) values (${postId}, ${userId}, ${body}, ${flagged}) returning id`;
    if (flagged) await flag(tx, "circle_post_comment", c.id);
    if (p.author_id !== userId) {
      await notify(tx, {
        userId: p.author_id, type: "circle_post_reply",
        data: { name: me.first_name, circle: p.circle_name, text: body.slice(0, 140), href: pinboardHref(p.circle_id) },
      });
    }
    return c.id;
  });
}

/** Eigene Kommentare löschen; Admins des Kreises entfernen jeden Kommentar */
export async function deleteComment(userId: string, commentId: string) {
  const [c] = await sql<{ author_id: string; my_role: string }[]>`
    select cm.author_id, m.role as my_role from circle_post_comments cm
      join circle_posts p on p.id = cm.post_id
      join circle_members m on m.circle_id = p.circle_id and m.user_id = ${userId} and m.status = 'active'
     where cm.id = ${commentId}`;
  if (!c) throw err.notFound("Diesen Kommentar gibt es nicht mehr.");
  if (c.author_id !== userId && c.my_role !== "admin") throw err.forbidden("Kommentare anderer entfernen nur Admins des Kreises.");
  await sql`delete from circle_post_comments where id = ${commentId}`;
}

// ---------------------------------------------------------------------------
// «Ich hab's»: Angebot auf einen Suchzettel
// ---------------------------------------------------------------------------

/**
 * Hält das Angebot fest und benachrichtigt die suchende Person. Der Link führt auf die
 * Exemplarseite, wo sie die normale Anfrage selbst stellt – es entsteht hier kein Vorgang.
 */
export async function offerCopy(userId: string, postId: string, copyId: string) {
  await rateLimit(`pinoffer:${userId}`, 20, 3600);
  return sql.begin(async (tx) => {
    const me = await assertActive(tx, userId);
    const p = await visiblePost(tx, postId, userId);
    if (p.kind !== "search") throw err.invalid("Ein Angebot geht nur auf einen Suchzettel.");
    if (p.author_id === userId) throw err.invalid("Das ist dein eigener Zettel.");
    const [c] = await tx<{ id: string; title: string; work_id: string; lendable: boolean; visible: boolean; paused: boolean }[]>`
      select c.id, w.title, e.work_id, cardinality(c.offers) > 0 as lendable, copy_visible_to(c.id, ${p.author_id}) as visible, o.shelf_paused as paused
        from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
       where c.id = ${copyId} and c.owner_id = ${userId} and c.removed_at is null`;
    if (!c || c.work_id !== p.work_id) throw err.invalid("Wähle ein eigenes Exemplar dieses Titels.");
    if (c.paused) throw err.conflict("shelf_paused", "Dein Regal ist gerade pausiert. Hebe die Pause auf, dann kannst du das Buch anbieten.");
    if (!c.lendable || !c.visible)
      throw err.conflict("not_offered", "Dieses Exemplar wird gerade nicht angeboten oder ist für die suchende Person nicht sichtbar. Ändere das zuerst im Regal.");
    const href = `/exemplar/${c.id}?zettel=${postId}`;
    const fresh = await tx`insert into circle_post_offers (post_id, copy_id, user_id) values (${postId}, ${c.id}, ${userId})
                           on conflict do nothing returning 1`;
    if (fresh.length) {
      await notify(tx, { userId: p.author_id, type: "circle_post_offer", data: { name: me.first_name, title: c.title, circle: p.circle_name, href } });
    }
    return { href, created: fresh.length > 0 };
  });
}

// ---------------------------------------------------------------------------
// Kalenderdatei einer Ankündigung mit Termin
// ---------------------------------------------------------------------------

export async function announcementIcs(userId: string, postId: string) {
  const [p] = await sql<{ body: string; event_at: Date | null; event_place: string | null; circle_name: string }[]>`
    select p.body, p.event_at, p.event_place, ci.name as circle_name
      from circle_posts p
      join circles ci on ci.id = p.circle_id
      join circle_members m on m.circle_id = p.circle_id and m.user_id = ${userId} and m.status = 'active'
      join users u on u.id = p.author_id
     where p.id = ${postId} and p.kind = 'announce' and ${listed(sql, userId)}`;
  if (!p?.event_at) throw err.notFound(NO_POST);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(p.event_at.getTime() + 60 * 60_000);
  const firstLine = p.body.split(/\r?\n/)[0].slice(0, 80);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leihregal//DE",
    "BEGIN:VEVENT",
    `UID:${postId}@leihregal`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(p.event_at)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${icsText(`${p.circle_name}: ${firstLine}`)}`,
    `DESCRIPTION:${icsText(p.body)}`,
    p.event_place ? `LOCATION:${icsText(p.event_place)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// ---------------------------------------------------------------------------
// Ansicht: alles, was die Oberfläche braucht, in einem Aufruf
// ---------------------------------------------------------------------------

type Row = {
  id: string; circle_id: string; kind: PostKind; text: string | null; created_at: Date; cursor: string;
  needed_by: string | null; fulfilled_at: Date | null; event_at: Date | null; event_place: string | null;
  author_id: string; author_name: string; author_avatar: string | null;
  work_id: string | null; copy_id: string | null;
  thanks: number; want: number; my_thanks: boolean; my_want: boolean; offered_by_me: boolean; offers: number;
};

/**
 * Zettel eines Kreises, neueste zuerst. `before` ist der Wert `nextBefore` der vorherigen Seite,
 * `only` lädt genau einen Zettel (nach einem Live-Ereignis).
 */
export async function listPosts(circleId: string, userId: string, opts: { before?: string | null; limit?: number; only?: string | null } = {}): Promise<PinboardPage> {
  const role = await memberRole(sql, circleId, userId);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const rows = await sql<Row[]>`
    select p.id, p.circle_id, p.kind, p.body as text, p.created_at, to_json(p.created_at) #>> '{}' as cursor,
           p.needed_by, p.fulfilled_at, p.event_at, p.event_place,
           p.author_id, u.first_name as author_name, u.avatar_key as author_avatar, p.work_id, p.copy_id,
           rx.thanks, rx.want, rx.my_thanks, rx.my_want,
           exists (select 1 from circle_post_offers o where o.post_id = p.id and o.user_id = ${userId}) as offered_by_me,
           (select count(*)::int from circle_post_offers o where o.post_id = p.id) as offers
      from circle_posts p
      join users u on u.id = p.author_id
      left join lateral (
        select count(*) filter (where r.kind = 'thanks')::int as thanks,
               count(*) filter (where r.kind = 'want')::int as want,
               coalesce(bool_or(r.kind = 'thanks' and r.user_id = ${userId}), false) as my_thanks,
               coalesce(bool_or(r.kind = 'want' and r.user_id = ${userId}), false) as my_want
          from circle_post_reactions r
         where r.post_id = p.id and ${notBlocked(sql, userId, sql`r.user_id`)}
      ) rx on true
     where p.circle_id = ${circleId} and ${listed(sql, userId)}
       ${opts.before ? sql`and p.created_at < ${opts.before}::timestamptz` : sql``}
       ${opts.only ? sql`and p.id = ${opts.only}` : sql``}
     order by p.created_at desc, p.id desc
     limit ${limit + 1}`;
  const page = rows.slice(0, limit);
  const nextBefore = rows.length > limit ? page[page.length - 1].cursor : null;
  if (!page.length) return { posts: [], nextBefore: null, role };

  const ids = page.map((r) => r.id);
  const copyIds = page.flatMap((r) => (r.copy_id ? [r.copy_id] : []));
  const searchWorks = [...new Set(page.filter((r) => r.kind === "search" && r.author_id !== userId).map((r) => r.work_id!))];

  const [copies, comments, mine] = await Promise.all([
    copyIds.length
      ? sql<PinCopy[]>`
          select c.id, e.work_id, w.title, w.authors, e.cover_key, c.owner_id,
                 ph.key as photo_key, ph.width as photo_w, ph.height as photo_h,
                 cur.due_at as lent_until,
                 case
                   when cur.id is not null then 'lent'
                   when exists (select 1 from loans a where a.copy_id = c.id and a.status = 'accepted') then 'reserved'
                   when exists (select 1 from loans r where r.copy_id = c.id and r.status = 'requested') then 'requested'
                   when o.shelf_paused and cardinality(c.offers) > 0 then 'paused'
                   when cardinality(c.offers) = 0 then 'not_offered'
                   else 'available'
                 end as status
            from copies c
            join editions e on e.id = c.edition_id
            join works w on w.id = e.work_id
            join users o on o.id = c.owner_id
            left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
            left join lateral (select l.id, l.due_at from loans l
                                where l.copy_id = c.id and l.status in ('active', 'return_reported', 'disputed') limit 1) cur on true
           where c.id in ${sql(copyIds)}`
      : ([] as PinCopy[]),
    sql<{ id: string; post_id: string; body: string; created_at: Date; author_id: string; first_name: string; avatar_key: string | null; total: number }[]>`
      select id, post_id, body, created_at, author_id, first_name, avatar_key, total from (
        select cm.id, cm.post_id, cm.body, cm.created_at, cm.author_id, x.first_name, x.avatar_key,
               row_number() over (partition by cm.post_id order by cm.created_at, cm.id) as n,
               count(*) over (partition by cm.post_id)::int as total
          from circle_post_comments cm join users x on x.id = cm.author_id
         where cm.post_id in ${sql(ids)} and cm.hidden_at is null and x.banned_at is null
           and ${notBlocked(sql, userId, sql`cm.author_id`)}
      ) t where n <= ${COMMENTS_PER_POST}
      order by post_id, n`,
    searchWorks.length
      ? sql<{ id: string; work_id: string; title: string; lendable: boolean }[]>`
          select c.id, e.work_id, e.title, cardinality(c.offers) > 0 as lendable
            from copies c join editions e on e.id = c.edition_id
           where c.owner_id = ${userId} and c.removed_at is null and e.work_id in ${sql(searchWorks)}
           order by c.created_at`
      : ([] as { id: string; work_id: string; title: string; lendable: boolean }[]),
  ]);

  // Werke: gesuchte Titel und die Werke der empfohlenen Exemplare, je mit einem Cover
  const copyById = new Map(copies.map((c) => [c.id, c]));
  const workIds = [...new Set([...page.flatMap((r) => (r.work_id ? [r.work_id] : [])), ...copies.map((c) => c.work_id)])];
  const works = workIds.length
    ? await sql<PinWork[]>`
        select w.id, w.title, w.authors,
               (select e.cover_key from editions e where e.work_id = w.id and e.cover_key is not null order by e.year desc nulls last limit 1) as cover_key
          from works w where w.id in ${sql(workIds)}`
    : [];
  const workById = new Map(works.map((w) => [w.id, w]));

  const posts = page.map((r): PinPost => {
    const copy = r.copy_id ? copyById.get(r.copy_id) ?? null : null;
    const own = r.author_id === userId;
    const cs = comments.filter((c) => c.post_id === r.id);
    return {
      id: r.id,
      circle_id: r.circle_id,
      kind: r.kind,
      author: { id: r.author_id, first_name: r.author_name, avatar_key: r.author_avatar },
      mine: own,
      text: r.text,
      created_at: r.created_at,
      work: workById.get(r.work_id ?? copy?.work_id ?? "") ?? null,
      copy,
      needed_by: r.needed_by,
      fulfilled_at: r.fulfilled_at,
      event_at: r.event_at,
      event_place: r.event_place,
      ics: r.kind === "announce" && r.event_at ? `/circles/${r.circle_id}/posts/${r.id}/ics` : null,
      reactions: { thanks: r.thanks, want: r.want, mine: { thanks: r.my_thanks, want: r.my_want } },
      comments: cs.map((c) => ({
        id: c.id,
        author: { id: c.author_id, first_name: c.first_name, avatar_key: c.avatar_key },
        body: c.body,
        created_at: c.created_at,
        canDelete: c.author_id === userId || role === "admin",
      })),
      comment_count: cs[0]?.total ?? 0,
      canDelete: own || role === "admin",
      myMatchingCopies: r.kind === "search" && !own ? mine.filter((m) => m.work_id === r.work_id).map(({ id, title, lendable }) => ({ id, title, lendable })) : [],
      offeredByMe: r.offered_by_me,
      offers: own ? r.offers : 0,
    };
  });
  return { posts, nextBefore, role };
}

/** Ein einzelner Zettel in derselben Form wie in der Liste (null, wenn er nicht mehr sichtbar ist) */
export async function getPost(circleId: string, userId: string, postId: string): Promise<PinPost | null> {
  return (await listPosts(circleId, userId, { only: postId, limit: 1 })).posts[0] ?? null;
}

/** Ein Mitglied verlässt den Kreis: seine Zettel, Kommentare, Reaktionen und Angebote dort verschwinden */
export async function removeMemberContent(tx: Tx, circleId: string, userId: string) {
  await tx`delete from circle_posts where circle_id = ${circleId} and author_id = ${userId}`;
  await tx`delete from circle_post_comments cm using circle_posts p where p.id = cm.post_id and p.circle_id = ${circleId} and cm.author_id = ${userId}`;
  await tx`delete from circle_post_reactions r using circle_posts p where p.id = r.post_id and p.circle_id = ${circleId} and r.user_id = ${userId}`;
  await tx`delete from circle_post_offers o using circle_posts p where p.id = o.post_id and p.circle_id = ${circleId} and o.user_id = ${userId}`;
}
