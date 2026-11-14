/**
 * Der Weg eines Buches und die Zettel im Buch.
 * Der Weg ist aus abgeschlossenen Vorgängen abgeleitet und anonym: Gemeinde und Monat, nie Namen
 * oder genaue Daten. Zettel sind ein Satz der leihenden Person für die nächsten Leserinnen und Leser –
 * Leihregals Antwort auf Rezensionen: etwas, das beim Buch bleibt, kein Urteil über Menschen.
 */
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { looksCommercial } from "@/lib/chat";

export const NOTE_MAX = 200;

export type BookPath = {
  /** verschiedene Menschen, die das Buch in der Hand hatten, die Besitzerin eingeschlossen */
  hands: number;
  municipalities: number;
  /** Monat der ersten Übergabe, JJJJ-MM */
  since: string;
  stations: { municipality: string | null; month: string }[];
};

/**
 * Stationen eines Exemplars: jede echte Übergabe aus einem abgeschlossenen Vorgang (Leihe, Geschenk,
 * Tausch – auch als Gegenstück eines Tauschs). Erst ab zwei Übergaben, sonst null.
 */
export async function bookPath(copyId: string): Promise<BookPath | null> {
  const rows = await sql<{ giver: string; receiver: string; month: string; municipality: string | null; giver_municipality: string | null }[]>`
    with hand as (
      -- das Exemplar selbst wurde übergeben: an die leihende, beschenkte oder tauschende Person
      select l.owner_id as giver, l.borrower_id as receiver, l.handed_over_at as ts
        from loans l
       where l.copy_id = ${copyId} and l.status = 'completed' and l.handed_over_at is not null
      union all
      -- als Gegenstück eines Tauschs: es ging an die andere Seite
      select l.borrower_id, l.owner_id, l.handed_over_at
        from loans l
       where l.swap_copy_id = ${copyId} and l.kind = 'swap' and l.status = 'completed' and l.handed_over_at is not null
      union all
      -- «Behalten gegen Tausch»: das angebotene Buch wechselte beim Abschluss
      select l.borrower_id, l.owner_id, l.closed_at
        from loans l
       where l.swap_offer_copy_id = ${copyId} and l.status = 'completed' and l.closed_at is not null
         and exists (select 1 from loan_events ev where ev.loan_id = l.id and ev.action = 'convert_to_swap')
    )
    select h.giver, h.receiver, to_char(h.ts at time zone 'Europe/Zurich', 'YYYY-MM') as month,
           r.municipality, g.municipality as giver_municipality
      from hand h join users r on r.id = h.receiver join users g on g.id = h.giver
     order by h.ts`;
  if (rows.length < 2) return null;
  const people = new Set<string>();
  const places = new Set<string>();
  for (const r of rows) {
    people.add(r.giver);
    people.add(r.receiver);
    if (r.municipality) places.add(r.municipality);
    if (r.giver_municipality) places.add(r.giver_municipality);
  }
  return {
    hands: people.size,
    municipalities: places.size,
    since: rows[0].month,
    stations: rows.map((r) => ({ municipality: r.municipality, month: r.month })),
  };
}

// ---------------------------------------------------------------------------
// Zettel im Buch
// ---------------------------------------------------------------------------

export type BookNote = {
  id: string;
  body: string;
  /** null, wenn anonym hinterlassen (oder das Konto gelöscht ist) */
  first_name: string | null;
  /** JJJJ-MM */
  month: string;
  /** nur für die Besitzerin sichtbar: ausgeblendete Zettel */
  hidden: boolean;
  mine: boolean;
};

/**
 * Darf diese Person zu diesem Vorgang (noch) einen Zettel hinterlassen? Dasselbe Fenster wie die
 * Bewertung: Vorgang abgeschlossen und die Bewertungsfrist läuft noch. Nur die leihende Person.
 */
export function noteWindowOpen(l: { status: string; borrower_id: string; rating_closes_at: Date | null }, userId: string) {
  return l.borrower_id === userId && l.status === "completed" && Boolean(l.rating_closes_at && l.rating_closes_at > new Date());
}

/** Für die Vorgangsseite: eigener Zettel und ob einer möglich ist */
export async function noteForLoan(tx: Tx, l: { id: string; status: string; borrower_id: string; rating_closes_at: Date | null }, userId: string) {
  if (l.borrower_id !== userId) return { canLeaveNote: false, note: null };
  const [note] = await tx<{ id: string; body: string; anonymous: boolean; created_at: Date }[]>`
    select id, body, anonymous, created_at from book_notes where loan_id = ${l.id} and author_id = ${userId}`;
  return { canLeaveNote: !note && noteWindowOpen(l, userId), note: note ?? null };
}

export async function leaveNote(userId: string, loanId: string, input: { body: string; anonymous?: boolean }) {
  await rateLimit(`note:${userId}`, 10, 3600);
  const body = input.body.trim();
  if (!body) throw err.invalid("Der Zettel ist leer.");
  if (body.length > NOTE_MAX) throw err.invalid("Der Zettel darf höchstens 200 Zeichen lang sein.");
  return sql.begin(async (tx) => {
    const [me] = await tx<{ banned_at: Date | null }[]>`select banned_at from users where id = ${userId} and deleted_at is null`;
    if (!me) throw err.unauthorized();
    if (me.banned_at) throw err.forbidden("Dein Konto ist gesperrt. Antworte auf die E-Mail der Moderation, um das zu klären.");
    const [l] = await tx<{ id: string; copy_id: string; status: string; borrower_id: string; owner_id: string; rating_closes_at: Date | null }[]>`
      select id, copy_id, status, borrower_id, owner_id, rating_closes_at from loans where id = ${loanId} for update`;
    if (!l || (l.borrower_id !== userId && l.owner_id !== userId)) throw err.notFound("Diesen Vorgang gibt es nicht.");
    if (l.borrower_id !== userId) throw err.forbidden("Einen Zettel im Buch hinterlässt nur, wer es geliehen hat.");
    const [has] = await tx`select 1 from book_notes where loan_id = ${loanId}`;
    if (has) throw err.conflict("already_noted", "Zu dieser Leihe gibt es schon einen Zettel.");
    if (!noteWindowOpen(l, userId)) throw err.conflict("note_closed", "Ein Zettel im Buch ist erst nach dem Abschluss und nur während der Bewertungsfrist möglich.");
    const flagged = looksCommercial(body);
    const [n] = await tx<{ id: string }[]>`
      insert into book_notes (copy_id, loan_id, author_id, body, anonymous, flagged)
      values (${l.copy_id}, ${loanId}, ${userId}, ${body}, ${input.anonymous ?? false}, ${flagged})
      returning id`;
    if (flagged) {
      await tx`insert into reports (reporter_id, target_type, target_id, reason, note)
               values (null, 'book_note', ${n.id}, 'price_pattern', 'Automatisch markiert')`;
    }
    return n.id;
  });
}

/**
 * Zettel eines Exemplars, älteste zuerst. Öffentlich wie die Exemplarseite: wer das Exemplar sehen darf,
 * sieht die Zettel. Ausgeblendete sieht nur die Besitzerin (mit hidden = true, zum Wiedereinblenden).
 */
export async function notesForCopy(copyId: string, viewerId: string | null): Promise<BookNote[]> {
  const [c] = await sql<{ owner_id: string; visible: boolean }[]>`
    select owner_id, copy_visible_to(id, ${viewerId}::uuid) as visible from copies where id = ${copyId}`;
  if (!c || !(c.visible || c.owner_id === viewerId)) throw err.notFound("Dieses Buch ist nicht mehr verfügbar.");
  const owner = c.owner_id === viewerId;
  return sql<BookNote[]>`
    select n.id, n.body,
           case when n.anonymous or u.id is null or u.deleted_at is not null then null else u.first_name end as first_name,
           to_char(n.created_at at time zone 'Europe/Zurich', 'YYYY-MM') as month,
           n.hidden_at is not null as hidden,
           coalesce(n.author_id = ${viewerId}::uuid, false) as mine
      from book_notes n left join users u on u.id = n.author_id
     where n.copy_id = ${copyId}
       and (n.hidden_at is null or ${owner})
       and (u.id is null or u.banned_at is null)
       and (${viewerId}::uuid is null or n.author_id is null or not exists (
             select 1 from blocks bl where (bl.blocker_id = n.author_id and bl.blocked_id = ${viewerId}::uuid)
                                        or (bl.blocker_id = ${viewerId}::uuid and bl.blocked_id = n.author_id)))
     order by n.created_at, n.id`;
}

/** Die Besitzerin blendet einzelne Zettel aus oder wieder ein. Was die Moderation ausgeblendet hat, bleibt es. */
export async function setNoteHidden(userId: string, noteId: string, hidden: boolean) {
  const [n] = await sql<{ hidden_by: string | null; hidden_at: Date | null }[]>`
    select n.hidden_by, n.hidden_at from book_notes n join copies c on c.id = n.copy_id
     where n.id = ${noteId} and c.owner_id = ${userId}`;
  if (!n) throw err.notFound("Diesen Zettel gibt es nicht mehr.");
  if (!hidden && n.hidden_at && n.hidden_by !== userId) throw err.forbidden("Diesen Zettel hat die Moderation ausgeblendet.");
  if (hidden) await sql`update book_notes set hidden_at = coalesce(hidden_at, now()), hidden_by = coalesce(hidden_by, ${userId}) where id = ${noteId}`;
  else await sql`update book_notes set hidden_at = null, hidden_by = null where id = ${noteId}`;
}
