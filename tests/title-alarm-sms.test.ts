/**
 * Titelalarm per SMS: Wird ein Buch von der Wunschliste im Umkreis frei, geht neben App/E-Mail/Push
 * eine SMS an die bestätigte Mobilnummer – mit Link zum Titel, höchstens einmal pro Woche und Titel,
 * und nicht, wenn die Person die SMS ausgeschaltet oder keine bestätigte Nummer hat.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/notify/sms", () => ({
  sendSms: async (to: string, text: string) => { sent.push({ to, text }); },
  smsConfigured: () => true,
}));

import { sql } from "@/lib/db";
import { addWish, runTitleAlarms } from "@/lib/wishlist";
import { runJob } from "@/worker/jobs";
import { makeCopy, makeUser, reset } from "./helpers";

async function runSmsJobs() {
  const q = await sql<{ id: number; kind: string; payload: Record<string, unknown>; attempts: number }[]>`select id, kind, payload, attempts from jobs where kind = 'send_sms' order by id`;
  for (const j of q) await runJob(j);
  await sql`delete from jobs where kind = 'send_sms'`;
}

async function wishFor(user: { id: string; plan_id: string }, copyId: string) {
  const [w] = await sql<{ work_id: string }[]>`select e.work_id from copies c join editions e on e.id = c.edition_id where c.id = ${copyId}`;
  await addWish(user.id, user.plan_id, w.work_id, 5);
  // Der Wunsch bestand schon, bevor das Exemplar ins Regal kam
  await sql`update wishlist_items set created_at = now() - interval '2 days' where user_id = ${user.id}`;
  return w.work_id;
}

describe("Titelalarm per SMS", () => {
  beforeEach(async () => { await reset(); sent.length = 0; });
  afterAll(async () => { await sql.end(); });

  it("schickt eine SMS mit Link zum Titel an die bestätigte Nummer", async () => {
    const lea = await makeUser("Lea");
    const marc = await makeUser("Marc");
    const copy = await makeCopy(marc, "Der Process", { offers: ["lend"] });
    const workId = await wishFor(lea, copy);
    expect(await runTitleAlarms()).toBe(1);
    await runSmsJobs();
    expect(sent).toHaveLength(1);
    const [u] = await sql<{ phone_e164: string }[]>`select phone_e164 from users where id = ${lea.id}`;
    expect(sent[0].to).toBe(u.phone_e164);
    expect(sent[0].text).toContain("Der Process");
    expect(sent[0].text).toContain(`/titel/${workId}`);
    // Innerhalb einer Woche kein zweiter Alarm für denselben Titel
    expect(await runTitleAlarms()).toBe(0);
  });

  it("keine SMS ohne bestätigte Nummer oder wenn ausgeschaltet – der Alarm in der App kommt trotzdem", async () => {
    const lea = await makeUser("Lea");
    const anna = await makeUser("Anna");
    const marc = await makeUser("Marc");
    await sql`update users set phone_verified_at = null where id = ${lea.id}`;
    await sql`update users set email_prefs = email_prefs || '{"sms_title_alarm": false}' where id = ${anna.id}`;
    const copy = await makeCopy(marc, "Stiller", { offers: ["lend"] });
    await wishFor(lea, copy);
    await wishFor(anna, copy);
    expect(await runTitleAlarms()).toBe(2);
    await runSmsJobs();
    expect(sent).toHaveLength(0);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where type = 'title_alarm' and channel = 'app'`;
    expect(n.n).toBe(2);
  });

  it("kein Alarm für eigene, ausgeliehene oder entfernte Exemplare", async () => {
    const lea = await makeUser("Lea");
    const own = await makeCopy(lea, "Homo faber", { offers: ["lend"] });
    await wishFor(lea, own);
    const marc = await makeUser("Marc");
    const gone = await makeCopy(marc, "Effi Briest", { offers: ["lend"] });
    await wishFor(lea, gone);
    await sql`update copies set removed_at = now() where id = ${gone}`;
    expect(await runTitleAlarms()).toBe(0);
  });
});
