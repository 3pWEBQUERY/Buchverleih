/**
 * Schnellfilter der Suche: Heute frei, ≤ 2 km, Per Post, Im Kreis – einzeln und kombiniert.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { searchWorks } from "@/lib/search";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

const origin = { lat: 47.522, lng: 8.54 };
const titles = (hits: { title: string }[]) => hits.map((h) => h.title).sort();

async function moveDisplay(userId: string, lat: number, lng: number) {
  await sql`update users set display_lat = ${lat}, display_lng = ${lng} where id = ${userId}`;
}

describe("Schnellfilter der Suche", () => {
  it("«Heute frei» blendet heute gebuchte Exemplare aus", async () => {
    const owner = await makeUser("Marc");
    const viewer = await makeUser("Lea");
    await makeCopy(owner, "Frei");
    const busy = await makeCopy(owner, "Gebucht");
    await makeCopy(owner, "Ab morgen gebucht").then((id) =>
      sql`insert into copy_bookings (copy_id, period) values (${id}, daterange(${day(1)}::date, ${day(5)}::date))`);
    await sql`insert into copy_bookings (copy_id, period) values (${busy}, daterange(${day(-1)}::date, ${day(3)}::date))`;
    expect(titles(await searchWorks(viewer.id, origin, {}))).toEqual(["Ab morgen gebucht", "Frei", "Gebucht"]);
    expect(titles(await searchWorks(viewer.id, origin, { availableNow: true }))).toEqual(["Ab morgen gebucht", "Frei"]);
  });

  it("«≤ 2 km» misst auf den Anzeigeorten und engt den Umkreis ein", async () => {
    const near = await makeUser("Nah");
    const far = await makeUser("Fern");
    const viewer = await makeUser("Lea");
    await moveDisplay(near.id, 47.53, 8.54); // rund 0.9 km
    await moveDisplay(far.id, 47.56, 8.54); // rund 4.2 km
    await makeCopy(near, "Nahes Buch");
    await makeCopy(far, "Fernes Buch");
    expect(titles(await searchWorks(viewer.id, origin, { radiusKm: 10 }))).toEqual(["Fernes Buch", "Nahes Buch"]);
    expect(titles(await searchWorks(viewer.id, origin, { radiusKm: 10, near: true }))).toEqual(["Nahes Buch"]);
    // Kleinerer Umkreis bleibt massgebend
    await moveDisplay(near.id, 47.536, 8.54); // rund 1.6 km
    expect(titles(await searchWorks(viewer.id, origin, { radiusKm: 1, near: true }))).toEqual([]);
    // Abgemeldet, mit PLZ-Ursprung
    expect(titles(await searchWorks(null, origin, { near: true }))).toEqual(["Nahes Buch"]);
  });

  it("«Per Post» zeigt nur Exemplare mit Versand", async () => {
    const owner = await makeUser("Marc");
    const viewer = await makeUser("Lea");
    await makeCopy(owner, "Mit Versand", { shipping_allowed: true });
    await makeCopy(owner, "Nur Abholung");
    expect(titles(await searchWorks(viewer.id, origin, { shipping: true }))).toEqual(["Mit Versand"]);
    expect(titles(await searchWorks(null, origin, { shipping: true }))).toEqual(["Mit Versand"]);
  });

  it("«Im Kreis» zeigt nur Exemplare aus aktiven eigenen Kreisen und lässt die Sichtbarkeit unangetastet", async () => {
    const owner = await makeUser("Marc");
    const viewer = await makeUser("Lea");
    const pendingViewer = await makeUser("Tom");
    const [k] = await sql<{ id: string }[]>`insert into circles (name, created_by, invite_code) values ('Lesekreis', ${owner.id}, ${"t-" + Math.random()}) returning id`;
    await sql`insert into circle_members (circle_id, user_id, role, status) values
      (${k.id}, ${owner.id}, 'admin', 'active'), (${k.id}, ${viewer.id}, 'member', 'active'), (${k.id}, ${pendingViewer.id}, 'member', 'pending')`;
    const shared = await makeCopy(owner, "Im Kreis geteilt", { visibility: "circles" });
    await sql`insert into circle_copies (circle_id, copy_id) values (${k.id}, ${shared})`;
    await makeCopy(owner, "Öffentlich");

    expect(titles(await searchWorks(viewer.id, origin, {}))).toEqual(["Im Kreis geteilt", "Öffentlich"]);
    expect(titles(await searchWorks(viewer.id, origin, { inCircle: true }))).toEqual(["Im Kreis geteilt"]);
    // Ausstehende Mitgliedschaft zählt nicht
    expect(titles(await searchWorks(pendingViewer.id, origin, { inCircle: true }))).toEqual([]);
    // Abgemeldet ohne Wirkung, Kreis-Exemplar bleibt unsichtbar
    expect(titles(await searchWorks(null, origin, { inCircle: true }))).toEqual(["Öffentlich"]);
    // Buch der Kreisbibliothek (gehört dem Kreis) zählt ebenfalls
    const lib = await makeCopy(owner, "Kreisbibliothek", { library_circle_id: k.id });
    await sql`insert into circle_copies (circle_id, copy_id) values (${k.id}, ${lib})`;
    expect(titles(await searchWorks(viewer.id, origin, { inCircle: true }))).toEqual(["Im Kreis geteilt", "Kreisbibliothek"]);
    await sql`delete from circle_copies where copy_id = ${lib}`;
    expect(titles(await searchWorks(viewer.id, origin, { inCircle: true }))).toEqual(["Im Kreis geteilt", "Kreisbibliothek"]);
    // Blockierte Person sieht das Kreis-Exemplar auch mit Filter nicht
    await sql`insert into blocks (blocker_id, blocked_id) values (${owner.id}, ${viewer.id})`;
    expect(titles(await searchWorks(viewer.id, origin, { inCircle: true }))).toEqual([]);
  });

  it("kombiniert alle Filter mit UND", async () => {
    const owner = await makeUser("Marc");
    const viewer = await makeUser("Lea");
    const [k] = await sql<{ id: string }[]>`insert into circles (name, created_by, invite_code) values ('Lesekreis', ${owner.id}, ${"t-" + Math.random()}) returning id`;
    await sql`insert into circle_members (circle_id, user_id, status) values (${k.id}, ${owner.id}, 'active'), (${k.id}, ${viewer.id}, 'active')`;
    const both = await makeCopy(owner, "Kreis und Post", { shipping_allowed: true });
    const onlyCircle = await makeCopy(owner, "Nur Kreis");
    await makeCopy(owner, "Nur Post", { shipping_allowed: true });
    await sql`insert into circle_copies (circle_id, copy_id) values (${k.id}, ${both}), (${k.id}, ${onlyCircle})`;
    const hits = await searchWorks(viewer.id, origin, { inCircle: true, shipping: true, near: true, availableNow: true });
    expect(titles(hits)).toEqual(["Kreis und Post"]);
  });
});
