/**
 * Chat im Vorgang (PRD 7.4) und Übergabe-Chat (4.10). Keine freien Direktnachrichten.
 * Terminvorschläge sind strukturierte Nachrichten mit Annehmen und Gegenvorschlag.
 */
import { systemText } from "@/lib/notify/system-texts";
import { sql, type Tx } from "@/lib/db";
import { err } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { isBlockedBetween } from "@/lib/trust";

export type Thread = { type: "loan"; id: string } | { type: "handover"; id: string };

export type Message = {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  body: string | null;
  proposal_place: string | null;
  proposal_at: Date | null;
  proposal_status: "open" | "accepted" | "countered" | "withdrawn" | null;
  proposal_accepted_by: string[];
  created_at: Date;
};

/** Mitglieder eines Threads */
export async function threadMembers(tx: Tx, t: Thread): Promise<{ members: string[]; readOnly: boolean; title: string }> {
  if (t.type === "loan") {
    const [l] = await tx<{ owner_id: string; borrower_id: string; status: string; closed_at: Date | null; title: string }[]>`
      select l.owner_id, l.borrower_id, l.status, l.closed_at, e.title
        from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id where l.id = ${t.id}`;
    if (!l) throw err.notFound();
    const readOnly = Boolean(l.closed_at && l.closed_at < new Date(Date.now() - 30 * 86400_000));
    return { members: [l.owner_id, l.borrower_id], readOnly, title: l.title };
  }
  const [h] = await tx<{ owner_id: string; prev_b: string; next_b: string; read_only_at: Date | null; title: string }[]>`
    select n.owner_id, p.borrower_id as prev_b, n.borrower_id as next_b, hc.read_only_at, e.title
      from handover_chats hc
      join loans p on p.id = hc.prev_loan_id
      join loans n on n.id = hc.next_loan_id
      join copies c on c.id = n.copy_id join editions e on e.id = c.edition_id
     where hc.id = ${t.id}`;
  if (!h) throw err.notFound();
  return { members: [h.owner_id, h.prev_b, h.next_b], readOnly: Boolean(h.read_only_at && h.read_only_at < new Date()), title: h.title };
}

export async function assertMember(t: Thread, userId: string) {
  const m = await threadMembers(sql, t);
  if (!m.members.includes(userId)) throw err.notFound();
  return m;
}

/**
 * Nachrichten eines Threads. `after`: nur neuere als diese Nachricht (inkrementelles Nachladen),
 * `only`: genau diese eine (wenn sich ein Terminvorschlag geändert hat).
 */
export async function listMessages(t: Thread, after?: string, only?: string) {
  const col = t.type === "loan" ? sql`m.loan_id` : sql`m.handover_chat_id`;
  return sql<Message[]>`
    select m.id, m.sender_id, u.first_name as sender_name, m.body, m.proposal_place, m.proposal_at, m.proposal_status,
           m.proposal_accepted_by, m.created_at
      from messages m left join users u on u.id = m.sender_id
     where ${col} = ${t.id}
       ${after ? sql`and (m.created_at, m.id) > (select created_at, id from messages where id = ${after})` : sql``}
       ${only ? sql`and m.id = ${only}` : sql``}
     order by m.created_at, m.id
     limit 500`;
}

// ---------------------------------------------------------------------------
// Lesestand
// ---------------------------------------------------------------------------

/** Lesestand eines anderen Mitglieds; `last_read_at` ist der Zeitpunkt der letzten gelesenen Nachricht (null: noch nie geöffnet) */
export type ThreadRead = { user_id: string; last_read_at: Date | null };

/**
 * Setzt den Lesestand auf eine Nachricht des Threads (ohne `messageId`: auf die neueste).
 * Der Stand wandert nur vorwärts; ein älterer Wert ändert nichts.
 */
async function setRead(tx: Tx, userId: string, t: Thread, messageId?: string | null) {
  const col = t.type === "loan" ? tx`m.loan_id` : tx`m.handover_chat_id`;
  const target = t.type === "loan" ? tx`(user_id, loan_id) where loan_id is not null` : tx`(user_id, handover_chat_id) where handover_chat_id is not null`;
  await tx`
    insert into thread_reads (user_id, loan_id, handover_chat_id, last_read_message_id, last_read_at)
    select ${userId}, m.loan_id, m.handover_chat_id, m.id, m.created_at
      from messages m
     where ${col} = ${t.id} ${messageId ? tx`and m.id = ${messageId}` : tx``}
     order by m.created_at desc, m.id desc limit 1
    on conflict ${target} do update
       set last_read_message_id = excluded.last_read_message_id, last_read_at = excluded.last_read_at
     where thread_reads.last_read_at < excluded.last_read_at`;
}

/**
 * Thread als gelesen markieren: bis zur Nachricht `messageId`, sonst bis zur neuesten.
 * Nur für Mitglieder des Threads. Gibt den danach gültigen Stand zurück (null: der Thread hat noch keine Nachricht).
 */
export async function markRead(userId: string, t: Thread, messageId?: string | null): Promise<{ last_read_at: Date | null }> {
  return sql.begin(async (tx) => {
    const m = await threadMembers(tx, t);
    if (!m.members.includes(userId)) throw err.notFound();
    if (messageId) {
      const [msg] = await tx<{ id: string }[]>`
        select id from messages where id = ${messageId} and ${t.type === "loan" ? tx`loan_id` : tx`handover_chat_id`} = ${t.id}`;
      if (!msg) throw err.notFound();
    }
    await setRead(tx, userId, t, messageId);
    // Mit dem Chat sind auch die Hinweise auf neue Nachrichten in diesem Vorgang gesehen
    if (t.type === "loan")
      await tx`update notifications set read_at = now() where user_id = ${userId} and loan_id = ${t.id} and type = 'message' and read_at is null`;
    const [r] = await tx<{ last_read_at: Date }[]>`
      select last_read_at from thread_reads
       where user_id = ${userId} and ${t.type === "loan" ? tx`loan_id` : tx`handover_chat_id`} = ${t.id}`;
    return { last_read_at: r?.last_read_at ?? null };
  });
}

/**
 * Lesestand der anderen Mitglieder (für «Gelesen» unter der letzten eigenen Nachricht:
 * gelesen ist sie, wenn jedes andere Mitglied mindestens bis zu ihrem Zeitpunkt gelesen hat).
 */
export async function threadReads(t: Thread, userId: string): Promise<ThreadRead[]> {
  const m = await assertMember(t, userId);
  const others = [...new Set(m.members.filter((x) => x !== userId))];
  const rows = await sql<{ user_id: string; last_read_at: Date }[]>`
    select user_id, last_read_at from thread_reads
     where ${t.type === "loan" ? sql`loan_id` : sql`handover_chat_id`} = ${t.id} and user_id in ${sql(others)}`;
  const at = new Map(rows.map((r) => [r.user_id, r.last_read_at]));
  return others.map((id) => ({ user_id: id, last_read_at: at.get(id) ?? null }));
}

/** Muster wie Preisangaben im Chat werden zur Prüfung markiert (PRD 6.5). */
const PRICE = /(\b\d+([.,]\d{1,2})?\s?(chf|fr\.?|franken|eur|€|\.-)(?=\W|$))|(\bchf\s?\d)|\btwint\b|\bzu verkaufen\b|\bverkaufe\b/i;

export function looksCommercial(text: string) {
  return PRICE.test(text);
}

export async function sendMessage(
  userId: string,
  t: Thread,
  input: { body?: string | null; proposalPlace?: string | null; proposalAt?: string | null },
) {
  await rateLimit(`msg:${userId}`, 60, 600);
  const body = input.body?.trim() || null;
  if (!body && !input.proposalAt) throw err.invalid("Die Nachricht ist leer.");
  if (input.proposalAt && new Date(input.proposalAt) < new Date(Date.now() - 3600_000))
    throw err.invalid("Der Termin liegt in der Vergangenheit.");
  return sql.begin(async (tx) => {
    const m = await threadMembers(tx, t);
    if (!m.members.includes(userId)) throw err.notFound();
    if (m.readOnly) throw err.conflict("read_only", "Dieser Chat ist geschlossen.");
    for (const other of m.members) {
      if (other !== userId && (await isBlockedBetween(tx, userId, other)))
        throw err.conflict("blocked", "Zwischen euch besteht eine Blockierung. Nachrichten sind nicht möglich.");
    }
    const flagged = body ? looksCommercial(body) : false;
    if (input.proposalAt) {
      // Ein neuer Vorschlag ersetzt offene ältere als Gegenvorschlag
      if (t.type === "loan") await tx`update messages set proposal_status = 'countered' where loan_id = ${t.id} and proposal_status = 'open'`;
      else await tx`update messages set proposal_status = 'countered' where handover_chat_id = ${t.id} and proposal_status = 'open'`;
    }
    const [msg] = await tx<{ id: string }[]>`
      insert into messages (loan_id, handover_chat_id, sender_id, body, proposal_place, proposal_at, proposal_status, proposal_accepted_by, flagged)
      values (${t.type === "loan" ? t.id : null}, ${t.type === "handover" ? t.id : null}, ${userId}, ${body},
              ${input.proposalPlace?.trim() || null}, ${input.proposalAt ?? null}, ${input.proposalAt ? "open" : null},
              ${input.proposalAt ? [userId] : []}::uuid[], ${flagged})
      returning id`;
    // Wer schreibt, hat den Thread bis hierhin gelesen
    await setRead(tx, userId, t, msg.id);
    if (flagged) {
      await tx`insert into reports (reporter_id, target_type, target_id, reason, note)
               values (null, 'message', ${msg.id}, 'price_pattern', 'Automatisch markiert')`;
    }
    const [me] = await tx<{ first_name: string }[]>`select first_name from users where id = ${userId}`;
    for (const other of m.members.filter((x) => x !== userId)) {
      await notify(tx, {
        userId: other,
        type: "message",
        loanId: t.type === "loan" ? t.id : null,
        data: { name: me.first_name, title: m.title, ...(body ? { text: body.slice(0, 140) } : systemText("chat_proposal")) },
      });
    }
    return msg.id;
  });
}

/** Annehmen eines Terminvorschlags. Im Übergabe-Chat gilt er erst, wenn alle Betroffenen angenommen haben. */
export async function acceptProposal(userId: string, messageId: string) {
  return sql.begin(async (tx) => {
    const [msg] = await tx<{ id: string; loan_id: string | null; handover_chat_id: string | null; sender_id: string; proposal_status: string; proposal_accepted_by: string[]; proposal_place: string | null; proposal_at: Date }[]>`
      select id, loan_id, handover_chat_id, sender_id, proposal_status, proposal_accepted_by, proposal_place, proposal_at
        from messages where id = ${messageId} for update`;
    if (!msg || msg.proposal_status !== "open") throw err.conflict("not_open", "Dieser Vorschlag ist nicht mehr offen.");
    const t: Thread = msg.loan_id ? { type: "loan", id: msg.loan_id } : { type: "handover", id: msg.handover_chat_id! };
    const m = await threadMembers(tx, t);
    if (!m.members.includes(userId)) throw err.notFound();
    const accepted = [...new Set([...msg.proposal_accepted_by, userId])];
    const all = m.members.every((x) => accepted.includes(x));
    await tx`update messages set proposal_accepted_by = ${accepted}::uuid[], proposal_status = ${all ? "accepted" : "open"} where id = ${messageId}`;
    if (all && t.type === "handover") {
      await tx`update handover_chats set agreed_place = ${msg.proposal_place}, agreed_at = ${msg.proposal_at} where id = ${t.id}`;
    }
    return { accepted: all };
  });
}

/**
 * Text für eine ICS-Eigenschaft nach RFC 5545: Backslash, Komma und Semikolon maskieren,
 * Zeilenumbrüche als \n, alle übrigen Steuerzeichen (auch ein einzelnes CR) entfernen.
 * So kann niemand über Ort oder Titel eigene Kalender-Eigenschaften einschleusen.
 */
export function icsText(s: string) {
  return s
    .replace(/\r\n|\r|\n/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, "\\n");
}

/** Kalenderdatei für einen angenommenen Termin (PRD 7.4) */
export async function proposalIcs(userId: string, messageId: string) {
  const [msg] = await sql<{ loan_id: string | null; handover_chat_id: string | null; proposal_place: string | null; proposal_at: Date; proposal_status: string }[]>`
    select loan_id, handover_chat_id, proposal_place, proposal_at, proposal_status from messages where id = ${messageId}`;
  if (!msg?.proposal_at) throw err.notFound();
  const t: Thread = msg.loan_id ? { type: "loan", id: msg.loan_id } : { type: "handover", id: msg.handover_chat_id! };
  const m = await assertMember(t, userId);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(msg.proposal_at.getTime() + 15 * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leihregal//DE",
    "BEGIN:VEVENT",
    `UID:${messageId}@leihregal`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(msg.proposal_at)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${icsText(`Buchübergabe: ${m.title}`)}`,
    msg.proposal_place ? `LOCATION:${icsText(msg.proposal_place)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
