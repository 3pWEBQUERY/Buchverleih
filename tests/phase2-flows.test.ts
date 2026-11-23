/**
 * Phase 2 im Leihablauf: Terminaufforderung bei Fälligkeit, Rückgabe über die Ablage,
 * Pflicht-Zustandsnotiz bei Weitergabe, Übergabe-Chat bei umgekehrter Annahme, Push pro Kategorie.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemToken } from "@/lib/loans/handover";
import { passOnConsent } from "@/lib/loans/passon";
import { notify } from "@/lib/notify";
import { updateCopy } from "@/lib/copies";
import { createCircle } from "@/lib/circles";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

async function upload(userId: string, purpose: string, key: string) {
  await sql`insert into uploads (user_id, purpose, raw_key, key, content_type, max_bytes, status)
            values (${userId}, ${purpose}, ${"raw/" + randomUUID()}, ${key}, 'image/jpeg', 1000, 'processed')`;
  return key;
}

async function lent(extra: Record<string, unknown> = {}) {
  const marc = await makeUser("Marc");
  const lea = await makeUser("Lea");
  const copy = await makeCopy(marc, "Faust", extra);
  const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
  await svc.accept(marc, l.id, {});
  await redeemToken(lea, (await createToken(marc, l.id)).token);
  return { marc, lea, l, copy };
}

describe("Fälligkeit", () => {
  it("bittet im Chat einmal um einen Rückgabetermin", async () => {
    const { runDeadlines, DUE_CHAT } = await import("@/worker/deadlines");
    const { l } = await lent();
    await ageLoan(l.id, 24 * 15);
    await runDeadlines();
    await runDeadlines();
    const msgs = await sql<{ body: string }[]>`select body from messages where loan_id = ${l.id} and sender_id is null and body = ${DUE_CHAT}`;
    expect(msgs).toHaveLength(1);
  });
});

describe("Rückgabe über die Ablage", () => {
  it("mit Foto, nur wenn das Buch die Ablage erlaubt", async () => {
    const a = await lent({ dropoff_allowed: false });
    const key = await upload(a.lea.id, "dropoff", `loans/${a.l.id}/dropoff/x1`);
    await expect(svc.reportReturn(a.lea, a.l.id, { dropoffPhotoKey: key })).rejects.toMatchObject({ status: 422 });

    await reset();
    const b = await lent({ dropoff_allowed: true });
    const key2 = await upload(b.lea.id, "dropoff", `loans/${b.l.id}/dropoff/x2`);
    await svc.reportReturn(b.lea, b.l.id, { dropoffPhotoKey: key2 });
    const [r] = await sql<{ status: string; return_photo_key: string }[]>`select status, return_photo_key from loans where id = ${b.l.id}`;
    expect(r).toEqual({ status: "return_reported", return_photo_key: key2 });
    // Einspruch löscht das Foto wieder
    await svc.objectReturn(b.marc, b.l.id);
    const [o] = await sql<{ return_photo_key: string | null }[]>`select return_photo_key from loans where id = ${b.l.id}`;
    expect(o.return_photo_key).toBeNull();
  });
});

describe("Direkte Weitergabe", () => {
  it("Zustandsnotiz ist Pflicht und braucht ein Foto; Übergabe-Chat auch bei umgekehrter Annahme", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea", { trust: 1 });
    const jonas = await makeUser("Jonas", { trust: 1 });
    const copy = await makeCopy(marc, "Der Zauberberg");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(17), end: day(30) });
    // Zuerst die spätere Leihe annehmen, dann die frühere
    await svc.accept(marc, b.id, {});
    await svc.accept(marc, a.id, {});
    const [chat] = await sql<{ n: number }[]>`select count(*)::int as n from handover_chats where prev_loan_id = ${a.id} and next_loan_id = ${b.id}`;
    expect(chat.n).toBe(1);

    await redeemToken(lea, (await createToken(marc, a.id)).token);
    await passOnConsent(marc, b.id, true);
    await passOnConsent(lea, b.id, true);
    await passOnConsent(jonas, b.id, true);
    await redeemToken(jonas, (await createToken(lea, b.id)).token);
    expect(await status(b.id)).toBe("active");

    await expect(svc.addConditionNote(jonas, b.id, { note: "Alles gut", photoKeys: [] })).rejects.toMatchObject({ status: 422 });
    const key = await upload(jonas.id, "condition", `loans/${b.id}/condition/c1`);
    await svc.addConditionNote(jonas, b.id, { note: "", photoKeys: [key] });
    const [n] = await sql<{ condition_photo_keys: string[] }[]>`select condition_photo_keys from loans where id = ${b.id}`;
    expect(n.condition_photo_keys).toEqual([key]);
  });

  it("ein Buch, das erstmals in einen Kreis kommt, wird «immer» weitergegeben", async () => {
    const marc = await makeUser("Marc");
    const circleId = await createCircle(marc.id, { name: "Leseclub" });
    const copy = await makeCopy(marc, "Momo");
    await updateCopy(marc.id, copy, { circleIds: [circleId] });
    const [c] = await sql<{ pass_on: string }[]>`select pass_on from copies where id = ${copy}`;
    expect(c.pass_on).toBe("always");
  });
});

describe("Push pro Kategorie", () => {
  it("abgeschaltete Kategorie: kein Push, Fälle immer", async () => {
    const u = await makeUser("Lea");
    await sql`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (${u.id}, 'https://fcm.googleapis.com/x', ${"k".repeat(30)}, ${"a".repeat(10)})`;
    await sql`update users set email_prefs = '{"push_requests": false}' where id = ${u.id}`;
    await sql.begin((tx) => notify(tx, { userId: u.id, type: "request_new", data: { title: "X" } }));
    await sql.begin((tx) => notify(tx, { userId: u.id, type: "case_opened", data: { title: "X" } }));
    const jobs = await sql<{ n: number }[]>`select count(*)::int as n from jobs where kind = 'send_push'`;
    expect(jobs[0].n).toBe(1);
  });
});
