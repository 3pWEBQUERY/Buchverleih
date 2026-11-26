import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { ratingProfile } from "@/lib/rating-profile";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);

describe("Öffentliches Bewertungsprofil", () => {
  it("zählt nach Rolle, sammelt Gründe und zeigt nur sichtbare Bewertungen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const tom = await makeUser("Tom");
    const copy = await makeCopy(marc, "Homo faber");
    const leaCopy = await makeCopy(lea, "Momo");
    const loan = async (copyId: string, owner: string, borrower: string, from: number) => (await sql<{ id: string }[]>`
      insert into loans (kind, status, copy_id, owner_id, borrower_id, wanted)
      values ('lend', 'completed', ${copyId}, ${owner}, ${borrower}, daterange(${day(from)}::date, ${day(from + 5)}::date)) returning id`)[0].id;
    const rate = (loanId: string, from: string, verdict: string, reasons: string[], visible = true) => sql`
      insert into ratings (loan_id, from_user, for_user, verdict, reasons, note, visible_from)
      values (${loanId}, ${from}, ${marc.id}, ${verdict}, ${reasons}, 'nur Moderation', ${visible ? sql`now() - interval '1 hour'` : sql`now() + interval '1 day'`})`;

    // Marc verleiht zweimal, leiht einmal
    await rate(await loan(copy, marc.id, lea.id, -40), lea.id, "good", []);
    await rate(await loan(copy, marc.id, tom.id, -30), tom.id, "problems", ["late", "communication"]);
    await rate(await loan(leaCopy, lea.id, marc.id, -20), lea.id, "good", []);
    // noch nicht sichtbar (die andere Seite hat noch nicht bewertet)
    await rate(await loan(copy, marc.id, lea.id, -10), lea.id, "problems", ["condition"], false);

    const p = await ratingProfile(marc.id);
    expect(p.total).toBe(3);
    expect(p.good).toBe(2);
    expect(p.goodPct).toBe(67);
    expect(p.asLender).toEqual({ good: 1, problems: 1 });
    expect(p.asBorrower).toEqual({ good: 1, problems: 0 });
    expect(p.reasons).toEqual({ late: 1, condition: 0, communication: 1, no_show: 0 });
    expect(p.recent).toHaveLength(3);
    // Keine Buchtitel, keine Namen der Bewertenden und keine Moderationsnotiz im öffentlichen Profil
    expect(JSON.stringify(p)).not.toMatch(/Homo faber|Momo|Moderation|Lea|Tom/);

    // Bewertungen gesperrter Konten zählen nicht
    await sql`update users set banned_at = now() where id = ${tom.id}`;
    expect((await ratingProfile(marc.id)).total).toBe(2);
  });

  it("ist leer ohne Bewertungen", async () => {
    const u = await makeUser("Eva");
    const p = await ratingProfile(u.id);
    expect(p).toMatchObject({ total: 0, goodPct: null, recent: [] });
  });
});
