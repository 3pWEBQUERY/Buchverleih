/** Kreisbibliothek (PRD 7.5): Bücher, die dem Kreis gehören, betreut von Admins. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addCopy } from "@/lib/copies";
import { createCircle, joinCircle, setMember, takeOverLibraryCopy } from "@/lib/circles";
import { circleShelf } from "@/lib/circle-queries";
import * as svc from "@/lib/loans/service";
import { makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

async function edition(title: string) {
  const [w] = await sql<{ id: string }[]>`insert into works (work_key, title, authors) values (${title + Math.random()}, ${title}, '{Autorin}') returning id`;
  const [e] = await sql<{ id: string }[]>`insert into editions (work_id, title, source) values (${w.id}, ${title}, 'manual') returning id`;
  return e.id;
}

async function setup() {
  const anna = await makeUser("Anna");
  const ben = await makeUser("Ben");
  const cara = await makeUser("Cara");
  const circleId = await createCircle(anna.id, { name: "Leseclub", loanDays: 42 });
  const [c] = await sql<{ invite_code: string }[]>`select invite_code from circles where id = ${circleId}`;
  await joinCircle(ben.id, c.invite_code);
  await joinCircle(cara.id, c.invite_code);
  return { anna, ben, cara, circleId };
}

describe("Kreisbibliothek", () => {
  it("nur Admins erfassen; das Buch ist nur im Kreis sichtbar und hat dessen Leihfrist", async () => {
    const { anna, ben, circleId } = await setup();
    await expect(addCopy(ben.id, await edition("Momo"), {}, { libraryCircleId: circleId })).rejects.toMatchObject({ status: 403 });
    const id = await addCopy(anna.id, await edition("Momo"), {}, { libraryCircleId: circleId });
    const [c] = await sql<{ visibility: string; loan_days: number; library_circle_id: string; in_circle: boolean }[]>`
      select visibility, loan_days, library_circle_id, exists (select 1 from circle_copies where copy_id = ${id} and circle_id = ${circleId}) as in_circle
        from copies where id = ${id}`;
    expect(c).toEqual({ visibility: "circles", loan_days: 42, library_circle_id: circleId, in_circle: true });
    const shelf = await circleShelf(circleId, ben.id);
    expect(shelf.find((x) => x.id === id)?.library).toBe(true);
    // Ein Mitglied kann anfragen, auch wenn die betreuende Person Ferien hat
    await sql`update users set shelf_paused = true where id = ${anna.id}`;
    const loan = await svc.requestLoan(ben, { copyId: id, kind: "lend" });
    expect(loan.owner_id).toBe(anna.id);
  });

  it("wer austritt, gibt die Betreuung an die nächste Admin-Person ab", async () => {
    const { anna, ben, circleId } = await setup();
    await setMember(anna.id, circleId, ben.id, "make_admin");
    const id = await addCopy(anna.id, await edition("Faust"), {}, { libraryCircleId: circleId });
    await setMember(anna.id, circleId, anna.id, "remove");
    const [c] = await sql<{ owner_id: string; library_circle_id: string | null; in_circle: boolean }[]>`
      select owner_id, library_circle_id, exists (select 1 from circle_copies where copy_id = ${id}) as in_circle from copies where id = ${id}`;
    expect(c).toEqual({ owner_id: ben.id, library_circle_id: circleId, in_circle: true });
  });

  it("Betreuung übernehmen: nur Admins und nicht während einer Leihe", async () => {
    const { anna, ben, cara, circleId } = await setup();
    await setMember(anna.id, circleId, ben.id, "make_admin");
    const id = await addCopy(anna.id, await edition("Siddhartha"), {}, { libraryCircleId: circleId });
    await expect(takeOverLibraryCopy(cara.id, circleId, id)).rejects.toMatchObject({ status: 403 });
    const loan = await svc.requestLoan(cara, { copyId: id, kind: "lend" });
    await expect(takeOverLibraryCopy(ben.id, circleId, id)).rejects.toMatchObject({ code: "library_busy" });
    await svc.withdraw(cara, loan.id);
    await takeOverLibraryCopy(ben.id, circleId, id);
    const [c] = await sql<{ owner_id: string }[]>`select owner_id from copies where id = ${id}`;
    expect(c.owner_id).toBe(ben.id);
  });

  it("Sichtbarkeit bleibt beim Kreis, auch wenn jemand sie ändern will", async () => {
    const { anna, circleId } = await setup();
    const { updateCopy } = await import("@/lib/copies");
    const id = await addCopy(anna.id, await edition("Steppenwolf"), {}, { libraryCircleId: circleId });
    await updateCopy(anna.id, id, { visibility: "all", circleIds: [] });
    const [c] = await sql<{ visibility: string; n: number }[]>`select visibility, (select count(*)::int from circle_copies where copy_id = ${id}) as n from copies where id = ${id}`;
    expect(c).toEqual({ visibility: "circles", n: 1 });
  });
});
