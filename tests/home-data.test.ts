/** Startseite: Genres aus app_stats, «Passt zu deiner Wunschliste», nächstes freies Buch. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { genreStats, refreshGenreStats, topGenres, wishlistMatches } from "@/lib/home-data";
import { nearestFreeCopy } from "@/lib/copies";
import { paletteData } from "@/lib/palette";
import * as svc from "@/lib/loans/service";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

const workOf = async (copyId: string) =>
  (await sql<{ work_id: string }[]>`select e.work_id from copies c join editions e on e.id = c.edition_id where c.id = ${copyId}`)[0].work_id;
const setGenre = async (copyId: string, genre: string) => sql`update works set genre = ${genre} where id = ${await workOf(copyId)}`;
const wish = async (userId: string, copyId: string, radiusKm = 5) =>
  sql`insert into wishlist_items (user_id, work_id, radius_km) values (${userId}, ${await workOf(copyId)}, ${radiusKm})`;
/** Regal rund 20 km nördlich */
const moveAway = (userId: string) => sql`update users set display_lat = 47.70, display_lng = 8.54 where id = ${userId}`;

describe("Genres der Startseite", () => {
  it("liest die gespeicherte Zählung und rechnet erst beim Auffrischen neu", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    await setGenre(await makeCopy(marc, "Krimi eins"), "Krimi");
    await setGenre(await makeCopy(marc, "Roman eins"), "Roman");
    await setGenre(await makeCopy(marc, "Roman zwei"), "Roman");

    // Frische Datenbank: die erste Anfrage rechnet und legt die Zeile an
    expect(await sql`select 1 from app_stats where key = 'genres'`).toHaveLength(0);
    expect(await topGenres(lea.id)).toEqual([{ genre: "Roman", n: 2 }, { genre: "Krimi", n: 1 }]);
    const [first] = await sql<{ refreshed_at: Date; value: unknown }[]>`select refreshed_at, value from app_stats where key = 'genres'`;
    expect(first.value).toEqual([{ genre: "Roman", n: 2 }, { genre: "Krimi", n: 1 }]);

    // Ein neues Buch ändert die gespeicherte Zählung nicht
    await setGenre(await makeCopy(marc, "Krimi zwei"), "Krimi");
    await setGenre(await makeCopy(marc, "Krimi drei"), "Krimi");
    expect(await topGenres(lea.id)).toEqual([{ genre: "Roman", n: 2 }, { genre: "Krimi", n: 1 }]);
    const [second] = await sql<{ refreshed_at: Date }[]>`select refreshed_at from app_stats where key = 'genres'`;
    expect(second.refreshed_at.getTime()).toBe(first.refreshed_at.getTime());

    // Der Worker frischt auf
    await refreshGenreStats();
    expect(await topGenres(lea.id)).toEqual([{ genre: "Krimi", n: 3 }, { genre: "Roman", n: 2 }]);
    expect(await genreStats()).toHaveLength(2);
    // Eigene Bücher zählen nicht mit
    expect(await topGenres(marc.id)).toEqual([]);
  });

  it("rechnet neu, wenn die Zeile überaltert ist (kein Worker)", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    await sql`insert into app_stats (key, value, refreshed_at) values ('genres', '[]', now() - interval '2 days')`;
    await setGenre(await makeCopy(marc, "Krimi"), "Krimi");
    expect(await topGenres(lea.id)).toEqual([{ genre: "Krimi", n: 1 }]);
  });
});

describe("Passt zu deiner Wunschliste", () => {
  it("zeigt freie Wunschtitel im Umkreis, sonst nichts", async () => {
    const me = await makeUser("Ich");
    const near = await makeUser("Nah");
    const far = await makeUser("Fern");
    const busy = await makeUser("Belegt");
    const blocked = await makeUser("Blockiert");
    const paused = await makeUser("Pause");
    await moveAway(far.id);

    const ok = await makeCopy(near, "Stiller");
    const tooFar = await makeCopy(far, "Homo faber");
    const lent = await makeCopy(busy, "Montauk");
    const hidden = await makeCopy(blocked, "Andorra");
    const onHold = await makeCopy(paused, "Biedermann");
    const removed = await makeCopy(near, "Gantenbein", { removed_at: new Date() });
    const notOffered = await makeCopy(near, "Blaubart", { offers: "{}" });
    const own = await makeCopy(me, "Tagebuch");
    const unwished = await makeCopy(near, "Nicht gewünscht");
    for (const c of [ok, tooFar, lent, hidden, onHold, removed, notOffered, own]) await wish(me.id, c);

    await sql`insert into copy_bookings (copy_id, period) values (${lent}, daterange(${day(-1)}::date, ${day(5)}::date))`;
    await sql`insert into blocks (blocker_id, blocked_id) values (${blocked.id}, ${me.id})`;
    await sql`update users set shelf_paused = true where id = ${paused.id}`;

    const hits = await wishlistMatches(me.id);
    expect(hits.map((h) => h.title)).toEqual(["Stiller"]);
    expect(hits[0]).toMatchObject({ id: ok, reason: "wishlist", href: `/exemplar/${ok}`, owner_name: "Nah", authors: ["Autorin"], photo_key: null, cover_key: null, photo_color: null, cover_color: null });
    expect(hits[0].work_id).toBe(await workOf(ok));
    // nur gerundet: mindestens 100 m, in Kilometern
    expect(hits[0].distance_km).toBeGreaterThanOrEqual(0.1);
    expect(hits[0].distance_km).toBeLessThan(1);
    expect(hits.some((h) => h.id === unwished)).toBe(false);

    // Grösserer Umkreis für diesen Wunsch: jetzt passt auch das ferne Buch
    await sql`update wishlist_items set radius_km = 30 where user_id = ${me.id} and work_id = ${await workOf(tooFar)}`;
    const wider = await wishlistMatches(me.id);
    expect(wider.map((h) => h.title)).toEqual(["Stiller", "Homo faber"]);
    expect(wider[1].distance_km).toBeGreaterThan(15);
    // Blockierung in die andere Richtung wirkt genauso
    await sql`insert into blocks (blocker_id, blocked_id) values (${me.id}, ${near.id})`;
    expect((await wishlistMatches(me.id)).map((h) => h.title)).toEqual(["Homo faber"]);
  });

  it("stellt Tauschtreffer voran und zeigt jedes Werk einmal", async () => {
    const me = await makeUser("Ich");
    const jonas = await makeUser("Jonas");
    const near = await makeUser("Nah");
    const mine = await makeCopy(me, "Mein Buch", { offers: "{lend,swap}" });
    const theirs = await makeCopy(jonas, "Sein Buch", { offers: "{lend,swap}" });
    const other = await makeCopy(near, "Wunschtitel");
    await wish(me.id, theirs);
    await wish(me.id, other);
    const [a, b] = me.id < jonas.id ? [me, jonas] : [jonas, me];
    await sql`insert into swap_matches (user_a, user_b, copy_for_a, copy_for_b)
              values (${a.id}, ${b.id}, ${a.id === me.id ? theirs : mine}, ${a.id === me.id ? mine : theirs})`;

    const hits = await wishlistMatches(me.id);
    expect(hits.map((h) => [h.title, h.reason])).toEqual([["Sein Buch", "swap"], ["Wunschtitel", "wishlist"]]);
    expect(await wishlistMatches(me.id, 1)).toHaveLength(1);
    // Jonas sieht umgekehrt mein Buch
    expect((await wishlistMatches(jonas.id)).map((h) => [h.id, h.reason])).toEqual([[mine, "swap"]]);

    // Ausgeblendete Treffer und entfernte Gegenstücke fallen weg; der Wunschtitel bleibt als gewöhnlicher Treffer
    await sql`update swap_matches set dismissed_by = array[${me.id}::uuid]`;
    expect((await wishlistMatches(me.id)).map((h) => [h.title, h.reason])).toEqual([["Sein Buch", "wishlist"], ["Wunschtitel", "wishlist"]]);
    await sql`update swap_matches set dismissed_by = '{}'`;
    await sql`update copies set removed_at = now() where id = ${mine}`;
    expect((await wishlistMatches(me.id)).every((h) => h.reason === "wishlist")).toBe(true);
  });
});

describe("Nächstes freies Buch", () => {
  it("nimmt das nächste freie, sichtbare Buch im Umkreis", async () => {
    const me = await makeUser("Ich");
    const near = await makeUser("Nah");
    const mid = await makeUser("Mitte");
    const blocked = await makeUser("Blockiert");
    expect(await nearestFreeCopy(me.id)).toBeNull();
    await makeCopy(me, "Eigenes");
    expect(await nearestFreeCopy(me.id)).toBeNull();

    await sql`update users set display_lat = 47.55, display_lng = 8.54 where id = ${mid.id}`; // rund 3 km
    await sql`update users set display_lat = 47.5221, display_lng = 8.5401 where id = ${blocked.id}`; // am nächsten, aber blockiert
    await sql`insert into blocks (blocker_id, blocked_id) values (${me.id}, ${blocked.id})`;
    await makeCopy(blocked, "Unsichtbar");
    const further = await makeCopy(mid, "Weiter weg");
    const closest = await makeCopy(near, "Ganz nah");

    const hit = await nearestFreeCopy(me.id);
    expect(hit).toMatchObject({ id: closest, title: "Ganz nah", owner_name: "Nah", authors: ["Autorin"], photo_color: null, cover_color: null });
    expect(hit!.distance_km).toBeLessThan(1);

    // Belegt: das nächste freie liegt weiter weg
    await sql`insert into copy_bookings (copy_id, period) values (${closest}, daterange(${day(0)}::date, ${day(3)}::date))`;
    const next = await nearestFreeCopy(me.id);
    expect(next!.id).toBe(further);
    expect(next!.distance_km).toBeGreaterThan(2);
    expect(await nearestFreeCopy(me.id, 1)).toBeNull();
    await sql`update users set shelf_paused = true where id = ${mid.id}`;
    expect(await nearestFreeCopy(me.id)).toBeNull();
  });
});

describe("Befehlspalette", () => {
  it("liefert eigene Bücher, aktive Kreise und laufende Vorgänge", async () => {
    const me = await makeUser("Ich");
    const lea = await makeUser("Lea");
    const first = await makeCopy(me, "Erstes");
    const second = await makeCopy(me, "Zweites");
    await makeCopy(me, "Entfernt", { removed_at: new Date() });
    await sql`update copies set created_at = now() - interval '1 day' where id = ${first}`;
    const [circle] = await sql<{ id: string }[]>`insert into circles (name, invite_code, created_by) values ('Lesekreis', 'abcdefghij', ${me.id}) returning id`;
    const [pending] = await sql<{ id: string }[]>`insert into circles (name, invite_code, created_by) values ('Wartend', 'bcdefghijk', ${lea.id}) returning id`;
    await sql`insert into circle_members (circle_id, user_id, role) values (${circle.id}, ${me.id}, 'admin')`;
    await sql`insert into circle_members (circle_id, user_id, status) values (${pending.id}, ${me.id}, 'pending')`;
    const open = await svc.requestLoan(lea, { copyId: first, kind: "lend" });
    const closed = await svc.requestLoan(lea, { copyId: second, kind: "lend" });
    await svc.withdraw(lea, closed.id);

    const mine = await paletteData(me.id);
    expect(mine.books).toEqual([{ id: second, title: "Zweites", authors: ["Autorin"] }, { id: first, title: "Erstes", authors: ["Autorin"] }]);
    expect(mine.circles).toEqual([{ id: circle.id, name: "Lesekreis" }]);
    expect(mine.loans).toEqual([{ id: open.id, title: "Erstes", other_first_name: "Lea", status: "requested", turn_is_mine: true }]);
    const hers = await paletteData(lea.id);
    expect(hers.books).toEqual([]);
    expect(hers.loans).toEqual([{ id: open.id, title: "Erstes", other_first_name: "Ich", status: "requested", turn_is_mine: false }]);
  });
});
