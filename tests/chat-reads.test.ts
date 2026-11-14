/** Lesestand im Chat: wer darf markieren, der Stand wandert nur vorwärts, ungelesene Zahl pro Vorgang. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { listMessages, markRead, sendMessage, threadReads, type Thread } from "@/lib/chat";
import { loanView, myLoans } from "@/lib/loans/queries";
import { exportData } from "@/lib/account";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

async function setup() {
  const marc = await makeUser("Marc");
  const lea = await makeUser("Lea");
  const tom = await makeUser("Tom");
  const copy = await makeCopy(marc, "Der Prozess");
  const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend", message: "Hallo Marc" });
  const thread: Thread = { type: "loan", id: loan.id };
  return { marc, lea, tom, copy, loan, thread };
}

const unread = async (userId: string, loanId: string) => (await myLoans(userId)).find((l) => l.id === loanId)!.unread_messages;

describe("Lesestand im Vorgangs-Chat", () => {
  it("nur Mitglieder dürfen markieren und den Lesestand sehen", async () => {
    const { tom, thread } = await setup();
    await expect(markRead(tom.id, thread)).rejects.toThrow(/Nicht gefunden/);
    await expect(threadReads(thread, tom.id)).rejects.toThrow(/Nicht gefunden/);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from thread_reads where user_id = ${tom.id}`;
    expect(n.n).toBe(0);
  });

  it("zählt nur Nachrichten anderer; eigene und Systemnachrichten nicht", async () => {
    const { marc, lea, loan, thread } = await setup();
    // Die Nachricht aus der Anfrage ist für Marc neu, für Lea nicht
    expect(await unread(marc.id, loan.id)).toBe(1);
    expect(await unread(lea.id, loan.id)).toBe(0);

    await sql`insert into messages (loan_id, sender_id, body) values (${loan.id}, null, 'Systemhinweis')`;
    expect(await unread(marc.id, loan.id)).toBe(1);
    expect(await unread(lea.id, loan.id)).toBe(0);

    // Wer schreibt, hat bis dahin gelesen
    await sendMessage(marc.id, thread, { body: "Hallo Lea" });
    expect(await unread(marc.id, loan.id)).toBe(0);
    expect(await unread(lea.id, loan.id)).toBe(1);
    await sendMessage(marc.id, thread, { body: "Passt Samstag?" });
    expect(await unread(lea.id, loan.id)).toBe(2);
    expect((await loanView(loan.id, lea.id)).unreadMessages).toBe(2);
    expect((await loanView(loan.id, marc.id)).unreadMessages).toBe(0);

    await markRead(lea.id, thread);
    expect(await unread(lea.id, loan.id)).toBe(0);
    expect((await loanView(loan.id, lea.id)).unreadMessages).toBe(0);
  });

  it("der Lesestand wandert nur vorwärts", async () => {
    const { marc, lea, loan, thread } = await setup();
    const first = await sendMessage(lea.id, thread, { body: "eins" });
    const second = await sendMessage(lea.id, thread, { body: "zwei" });
    const third = await sendMessage(lea.id, thread, { body: "drei" });
    const msgs = await listMessages(thread);
    const at = (id: string) => msgs.find((m) => m.id === id)!.created_at.getTime();

    const a = await markRead(marc.id, thread, second);
    expect(a.last_read_at!.getTime()).toBe(at(second));
    expect(await unread(marc.id, loan.id)).toBe(1);

    // Zurück geht es nicht
    const b = await markRead(marc.id, thread, first);
    expect(b.last_read_at!.getTime()).toBe(at(second));
    expect(await unread(marc.id, loan.id)).toBe(1);

    // Ohne Angabe: bis zur neuesten Nachricht
    const c = await markRead(marc.id, thread);
    expect(c.last_read_at!.getTime()).toBe(at(third));
    expect(await unread(marc.id, loan.id)).toBe(0);
    const [row] = await sql<{ last_read_message_id: string }[]>`select last_read_message_id from thread_reads where user_id = ${marc.id} and loan_id = ${loan.id}`;
    expect(row.last_read_message_id).toBe(third);
    const [rows] = await sql<{ n: number }[]>`select count(*)::int as n from thread_reads where user_id = ${marc.id}`;
    expect(rows.n).toBe(1);
  });

  it("eine Nachricht aus einem anderen Thread gilt nicht", async () => {
    const { marc, lea, thread } = await setup();
    const other = await makeCopy(marc, "Stiller");
    const loan2 = await svc.requestLoan(lea, { copyId: other, kind: "lend" });
    const foreign = await sendMessage(lea.id, { type: "loan", id: loan2.id }, { body: "anderswo" });
    await expect(markRead(marc.id, thread, foreign)).rejects.toThrow(/Nicht gefunden/);
  });

  it("liefert den Lesestand nur der anderen Person", async () => {
    const { marc, lea, thread } = await setup();
    // Lea hat noch nichts markiert: die Anfrage-Nachricht entsteht ohne Lesestand
    expect(await threadReads(thread, marc.id)).toEqual([{ user_id: lea.id, last_read_at: null }]);
    const mine = await sendMessage(marc.id, thread, { body: "Gern" });
    const [msg] = await listMessages(thread, undefined, mine);

    // «Gelesen» erst, wenn Lea bis zu Marcs Nachricht gelesen hat
    await markRead(lea.id, thread);
    const reads = await threadReads(thread, marc.id);
    expect(reads).toHaveLength(1);
    expect(reads[0].user_id).toBe(lea.id);
    expect(reads[0].last_read_at!.getTime()).toBeGreaterThanOrEqual(msg.created_at.getTime());
    // Lea sieht umgekehrt nur Marcs Stand (er hat mit dem Senden gelesen)
    const forLea = await threadReads(thread, lea.id);
    expect(forLea.map((r) => r.user_id)).toEqual([marc.id]);
    expect(forLea[0].last_read_at!.getTime()).toBe(msg.created_at.getTime());
  });

  it("markiert die Hinweise auf neue Nachrichten im Vorgang als gesehen, andere nicht", async () => {
    const { marc, lea, loan, thread } = await setup();
    await sendMessage(marc.id, thread, { body: "Hallo" });
    const open = () => sql<{ type: string }[]>`select type from notifications where user_id = ${lea.id} and loan_id = ${loan.id} and channel = 'app' and read_at is null order by type`;
    await sql`insert into notifications (user_id, type, channel, loan_id) values (${lea.id}, 'accepted', 'app', ${loan.id})`;
    expect((await open()).map((n) => n.type)).toEqual(["accepted", "message"]);
    await markRead(lea.id, thread);
    expect((await open()).map((n) => n.type)).toEqual(["accepted"]);
  });

  it("meldet den geänderten Lesestand live und nur bei einer Änderung", async () => {
    const { marc, lea, loan, thread } = await setup();
    const seen: Record<string, unknown>[] = [];
    const l = await sql.listen("chat", (p) => { const m = JSON.parse(p); if (m.read) seen.push(m); });
    try {
      await markRead(marc.id, thread);
      await markRead(marc.id, thread); // unverändert: keine zweite Meldung
      await new Promise((r) => setTimeout(r, 300));
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ loan_id: loan.id, handover_chat_id: null, user_id: marc.id, read: true });
      expect(Number.isNaN(new Date(seen[0].last_read_at as string).getTime())).toBe(false);
      expect(lea.id).not.toBe(seen[0].user_id);
    } finally {
      await l.unlisten();
    }
  });

  it("gehört zu Datenexport und Kontolöschung", async () => {
    const { marc, lea, loan, thread } = await setup();
    await markRead(marc.id, thread);
    const data = await exportData(marc.id);
    expect(data.threadReads).toHaveLength(1);
    expect(data.threadReads[0].loan_id).toBe(loan.id);
    await svc.withdraw(lea, loan.id);
    const { deleteAccount } = await import("@/lib/account");
    await deleteAccount(marc.id).catch(() => {});
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from thread_reads where user_id = ${marc.id}`;
    expect(n.n).toBe(0);
  });
});

describe("Lesestand im Übergabe-Chat", () => {
  it("drei Mitglieder: jede Person sieht den Stand der beiden anderen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const tom = await makeUser("Tom");
    const eva = await makeUser("Eva");
    const copy = await makeCopy(marc, "Homo faber");
    const mk = async (borrower: string, from: number, to: number) => (await sql<{ id: string }[]>`
      insert into loans (kind, status, copy_id, owner_id, borrower_id, wanted)
      values ('lend', 'accepted', ${copy}, ${marc.id}, ${borrower}, daterange(${day(from)}::date, ${day(to)}::date)) returning id`)[0].id;
    const prev = await mk(lea.id, 1, 10);
    const next = await mk(tom.id, 20, 30);
    const [hc] = await sql<{ id: string }[]>`insert into handover_chats (prev_loan_id, next_loan_id) values (${prev}, ${next}) returning id`;
    const thread: Thread = { type: "handover", id: hc.id };

    await expect(markRead(eva.id, thread)).rejects.toThrow(/Nicht gefunden/);
    const msg = await sendMessage(lea.id, thread, { body: "Ich bringe es am Samstag." });
    const [m] = await listMessages(thread, undefined, msg);

    const sorted = (r: { user_id: string }[]) => r.map((x) => x.user_id).sort();
    let reads = await threadReads(thread, lea.id);
    expect(sorted(reads)).toEqual([marc.id, tom.id].sort());
    expect(reads.every((r) => r.last_read_at === null)).toBe(true);

    await markRead(tom.id, thread, msg);
    reads = await threadReads(thread, lea.id);
    expect(reads.find((r) => r.user_id === tom.id)!.last_read_at!.getTime()).toBe(m.created_at.getTime());
    expect(reads.find((r) => r.user_id === marc.id)!.last_read_at).toBeNull();
    // erst wenn alle anderen gelesen haben, gilt die Nachricht als gelesen
    const allRead = (rs: typeof reads) => rs.every((r) => r.last_read_at !== null && r.last_read_at >= m.created_at);
    expect(allRead(reads)).toBe(false);
    await markRead(marc.id, thread);
    expect(allRead(await threadReads(thread, lea.id))).toBe(true);

    // Tom sieht Lea (hat mit dem Senden gelesen) und Marc, nicht sich selbst
    expect(sorted(await threadReads(thread, tom.id))).toEqual([lea.id, marc.id].sort());
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from thread_reads where handover_chat_id = ${hc.id} and loan_id is null`;
    expect(n.n).toBe(3);
  });
});
