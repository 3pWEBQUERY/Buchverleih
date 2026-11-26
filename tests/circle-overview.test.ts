/** Kreis auf einen Blick: neu im Regal, gesuchte Titel mit Treffer, eigene Übergaben (nur die eigenen). */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { createCircle, joinCircle } from "@/lib/circles";
import { circleOverview } from "@/lib/circle-overview";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

async function setup() {
  const anna = await makeUser("Anna");
  const ben = await makeUser("Ben");
  const cara = await makeUser("Cara");
  const dave = await makeUser("Dave");
  const circleId = await createCircle(anna.id, { name: "Haus 12" });
  const [c] = await sql<{ invite_code: string }[]>`select invite_code from circles where id = ${circleId}`;
  await joinCircle(ben.id, c.invite_code);
  await joinCircle(cara.id, c.invite_code);
  return { anna, ben, cara, dave, circleId };
}

const share = (circleId: string, copyId: string) => sql`insert into circle_copies (circle_id, copy_id) values (${circleId}, ${copyId})`;
const workOf = async (copyId: string) => (await sql<{ work_id: string }[]>`select e.work_id from copies c join editions e on e.id = c.edition_id where c.id = ${copyId}`)[0].work_id;

async function loan(copyId: string, ownerId: string, borrowerId: string, status: "accepted" | "active", from: number, dueIn?: number) {
  const [l] = await sql<{ id: string }[]>`
    insert into loans (kind, status, copy_id, owner_id, borrower_id, wanted, due_at, handed_over_at)
    values ('lend', ${status}, ${copyId}, ${ownerId}, ${borrowerId}, daterange(${day(from)}::date, ${day(from + 14)}::date),
            ${dueIn === undefined ? null : sql`(${day(dueIn + 1)}::date)::timestamp at time zone 'Europe/Zurich'`},
            ${status === "active" ? sql`now()` : null})
    returning id`;
  return l.id;
}

describe("Kreis auf einen Blick", () => {
  it("zeigt neue Bücher der letzten 14 Tage, ohne entfernte, gesperrte oder blockierte", async () => {
    const { anna, ben, cara, circleId } = await setup();
    const fresh = await makeCopy(ben, "Momo");
    const old = await makeCopy(ben, "Stiller", { created_at: new Date(Date.now() - 30 * 86_400_000) });
    const removed = await makeCopy(ben, "Faust", { removed_at: new Date() });
    const blocked = await makeCopy(cara, "Heidi");
    for (const id of [fresh, old, removed, blocked]) await share(circleId, id);
    await sql`insert into blocks (blocker_id, blocked_id) values (${cara.id}, ${anna.id})`;

    const o = await circleOverview(circleId, anna.id);
    expect(o.new.map((c) => c.title)).toEqual(["Momo"]);
    expect(o.new[0].owner_name).toBe("Ben");

    await sql`update users set banned_at = now() where id = ${ben.id}`;
    expect((await circleOverview(circleId, anna.id)).new).toEqual([]);
  });

  it("gesucht im Kreis: Wunsch eines Mitglieds, den ein anderes Mitglied im Regal hat", async () => {
    const { anna, ben, cara, circleId } = await setup();
    const momo = await makeCopy(ben, "Momo");
    await share(circleId, momo);
    const lonely = await makeCopy(ben, "Nicht im Kreis");
    await sql`insert into wishlist_items (user_id, work_id, share_circles) values (${cara.id}, ${await workOf(momo)}, true), (${cara.id}, ${await workOf(lonely)}, true)`;

    const o = await circleOverview(circleId, anna.id);
    expect(o.wanted).toHaveLength(1);
    expect(o.wanted[0]).toMatchObject({ title: "Momo", copy_id: momo, owner_name: "Ben", count: 1, mine: false });
    // Ben sieht sein eigenes Buch als Treffer
    expect((await circleOverview(circleId, ben.id)).wanted[0]).toMatchObject({ copy_id: momo, mine: true });
  });

  it("nächste Übergaben: nur eigene Leihen mit Mitgliedern dieses Kreises, nie die anderer", async () => {
    const { anna, ben, cara, dave, circleId } = await setup();
    const a1 = await makeCopy(anna, "Homo faber");
    const a2 = await makeCopy(anna, "Andorra");
    const a3 = await makeCopy(anna, "Krabat");
    const b1 = await makeCopy(ben, "Momo");

    const mine = await loan(a1, anna.id, ben.id, "accepted", 2); // Übergabe an Ben in 2 Tagen
    await loan(a2, anna.id, dave.id, "accepted", 1); // Dave ist nicht im Kreis
    await loan(a3, anna.id, cara.id, "accepted", 20); // zu weit weg
    const others = await loan(b1, ben.id, cara.id, "active", -10, 3); // Leihe zwischen Ben und Cara

    const o = await circleOverview(circleId, anna.id);
    expect(o.handovers.map((h) => h.loan_id)).toEqual([mine]);
    expect(o.handovers[0]).toMatchObject({ kind: "handover", role: "owner", other_name: "Ben", day: day(2) });
    // Privatsphäre: Bens und Caras Leihe taucht bei Anna nicht auf
    expect(o.handovers.some((h) => h.loan_id === others)).toBe(false);

    const c = await circleOverview(circleId, cara.id);
    expect(c.handovers.map((h) => h.loan_id)).toEqual([others]);
    expect(c.handovers[0]).toMatchObject({ kind: "return", role: "borrower", other_name: "Ben", day: day(3) });

    // Wer nicht (mehr) aktiv im Kreis ist, fällt weg
    await sql`delete from circle_members where circle_id = ${circleId} and user_id = ${ben.id}`;
    expect((await circleOverview(circleId, anna.id)).handovers).toEqual([]);
  });

  it("nur für aktive Mitglieder", async () => {
    const { circleId, dave } = await setup();
    await expect(circleOverview(circleId, dave.id)).rejects.toMatchObject({ status: 404 });
  });
});
