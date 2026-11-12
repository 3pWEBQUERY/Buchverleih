/**
 * Web-Push: Abo pro Sitzung, Auslösen über notify(), Aufräumen abgelaufener Abos.
 * Der Push-Dienst selbst wird simuliert.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { endpoint: string; payload: string }[] = [];
const gone = new Set<string>();
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "BPub" + Math.random().toString(36).slice(2), privateKey: "priv" }),
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (gone.has(sub.endpoint)) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    },
  },
}));

import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";
import { subscribe, unsubscribe, vapidKeys, deviceCount } from "@/lib/push";
import { nextJob, runJob } from "@/worker/jobs";
import { makeUser, reset } from "./helpers";

async function withSession(name: string) {
  const u = await makeUser(name);
  const [s] = await sql<{ id: string }[]>`insert into sessions (user_id, token_hash, expires_at) values (${u.id}, ${"h" + Math.random()}, now() + interval '1 day') returning id`;
  return { ...u, session_id: s.id };
}

async function drain() {
  for (let j = await nextJob(); j; j = await nextJob()) await runJob(j);
}

const keys = { p256dh: "BKey" + "x".repeat(60), auth: "authauthauth" };

beforeEach(async () => {
  await reset();
  await sql`truncate push_subscriptions`;
  sent.length = 0;
  gone.clear();
});
afterAll(() => sql.end());

describe("Push", () => {
  it("VAPID-Schlüssel entstehen einmal und bleiben gleich", async () => {
    const a = await vapidKeys();
    const b = await vapidKeys();
    expect(a.publicKey).toBe(b.publicKey);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from app_keys where name = 'vapid'`;
    expect(n.n).toBe(1);
  });

  it("notify() schickt an alle Geräte; gelesene nicht mehr", async () => {
    const lea = await withSession("Lea");
    await subscribe(lea, { endpoint: "https://push.example/a", ...keys }, "Test");
    await subscribe(lea, { endpoint: "https://push.example/b", ...keys }, "Test");
    expect(await deviceCount(lea.id)).toBe(2);

    await notify(sql, { userId: lea.id, type: "request_new", data: { title: "Stiller", name: "Marc", kind: "lend" } });
    await drain();
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push.example/a", "https://push.example/b"]);
    const msg = JSON.parse(sent[0].payload);
    expect(msg.title).toContain("Marc");
    expect(msg.href).toBe("/benachrichtigungen");

    // Schon in der App gelesen: kein Push mehr
    sent.length = 0;
    await notify(sql, { userId: lea.id, type: "request_new", data: { title: "Homo faber", name: "Marc", kind: "lend" } });
    await sql`update notifications set read_at = now() where user_id = ${lea.id}`;
    await drain();
    expect(sent).toHaveLength(0);
  });

  it("ohne Gerät kein Job; abgelaufene Abos verschwinden; Abmelden löscht das Abo", async () => {
    const lea = await withSession("Lea");
    await notify(sql, { userId: lea.id, type: "request_new", data: { title: "Stiller", name: "Marc" } });
    const [j] = await sql<{ n: number }[]>`select count(*)::int as n from jobs where kind = 'send_push'`;
    expect(j.n).toBe(0);

    await subscribe(lea, { endpoint: "https://push.example/alt", ...keys }, null);
    gone.add("https://push.example/alt");
    await notify(sql, { userId: lea.id, type: "request_new", data: { title: "Stiller", name: "Marc" } });
    await drain();
    expect(await deviceCount(lea.id)).toBe(0);

    await subscribe(lea, { endpoint: "https://push.example/c", ...keys }, null);
    await sql`delete from sessions where id = ${lea.session_id}`;
    expect(await deviceCount(lea.id)).toBe(0);
  });

  it("ein Endpunkt gehört immer dem zuletzt angemeldeten Konto; nur https", async () => {
    const lea = await withSession("Lea");
    const marc = await withSession("Marc");
    await subscribe(lea, { endpoint: "https://push.example/geteilt", ...keys }, null);
    await subscribe(marc, { endpoint: "https://push.example/geteilt", ...keys }, null);
    expect(await deviceCount(lea.id)).toBe(0);
    expect(await deviceCount(marc.id)).toBe(1);
    await unsubscribe(lea, "https://push.example/geteilt");
    expect(await deviceCount(marc.id)).toBe(1);
    await expect(subscribe(lea, { endpoint: "http://push.example/x", ...keys }, null)).rejects.toThrow(/Push-Endpunkt/);
  });
});
