/** Import aus Goodreads und StoryGraph: CSV lesen, Vorschläge, Übernahme ins Regal und auf die Wunschliste. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { importRows, parseCsv, parseLibrary, suggestTarget } from "@/lib/import";
import { makeUser, reset } from "./helpers";

// Keine echten Katalogabfragen im Test
vi.mock("@/lib/catalog/lookup", async (orig) => ({
  ...(await orig<typeof import("@/lib/catalog/lookup")>()),
  lookupExternal: async () => null,
  searchExternal: async () => [],
}));

beforeEach(async () => { await reset(); await sql`update features set enabled = true`; });
afterAll(() => sql.end());

const GOODREADS = [
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies",
  `1,"Der Steppenwolf","Hermann Hesse","Hesse, Hermann",,"=""3518366750""","=""9783518366752""",5,4.1,Suhrkamp,Paperback,288,1974,1927,2024/01/01,2023/12/01,,,read,"Gross, ""wirklich""",,,1,0`,
  `2,"Momo","Michael Ende","Ende, Michael",,"=""""","=""""",0,4.3,Thienemann,Hardcover,300,1973,1973,,2024/02/01,to-read,to-read (#1),to-read,,,,0,0`,
  `3,"Mehrzeilig: Ein Titel","Anna Muster","Muster, Anna","Ben Beispiel",,,0,0,,,,,,,2024/02/01,,,currently-reading,"Zeile 1`,
  `Zeile 2",,,0,1`,
].join("\n");

const STORYGRAPH = [
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?",
  "Faust,Johann Wolfgang von Goethe,,9783150000014,paperback,read,2024/01/01,,,1,,,,,,,,4.0,,,,,No",
  "Siddhartha,Hermann Hesse,,9783518366981,paperback,read,2024/01/01,,,1,,,,,,,,4.0,,,,,Yes",
  "Unterm Rad,Hermann Hesse,,,paperback,did-not-finish,2024/01/01,,,0,,,,,,,,,,,,,",
].join("\r\n");

describe("CSV lesen", () => {
  it("Anführungszeichen, verdoppelte Anführungszeichen und Zeilenumbrüche im Feld", () => {
    expect(parseCsv('a,"b ""c""","d\ne"\n1,2,3')).toEqual([["a", 'b "c"', "d\ne"], ["1", "2", "3"]]);
  });

  it("Goodreads: ISBN mit =\"\", Regale, Besitz und Mitautoren", () => {
    const { format, rows } = parseLibrary(GOODREADS);
    expect(format).toBe("goodreads");
    expect(rows.map((r) => [r.title, r.isbn13, r.status, r.owned])).toEqual([
      ["Der Steppenwolf", "9783518366752", "read", null],
      ["Momo", null, "to-read", null],
      ["Mehrzeilig: Ein Titel", null, "reading", true],
    ]);
    expect(rows[2].authors).toEqual(["Anna Muster", "Ben Beispiel"]);
    expect(rows[0].year).toBe(1974);
    expect(rows.map(suggestTarget)).toEqual(["shelf", "wish", "shelf"]);
  });

  it("StoryGraph: Status und «Owned?»", () => {
    const { format, rows } = parseLibrary(STORYGRAPH);
    expect(format).toBe("storygraph");
    expect(rows.map((r) => [r.title, r.status, r.owned])).toEqual([["Faust", "read", false], ["Siddhartha", "read", true], ["Unterm Rad", "dnf", null]]);
    expect(rows.map(suggestTarget)).toEqual(["skip", "shelf", "skip"]);
  });

  it("unbekannte Dateien und leere Exporte werden abgelehnt", () => {
    expect(() => parseLibrary("a,b\n1,2")).toThrow(/kennen wir nicht/);
    expect(() => parseLibrary(GOODREADS.split("\n")[0])).toThrow(/keine Bücher/);
  });
});

describe("Übernehmen", () => {
  it("legt Exemplare und Wünsche an, erkennt Doppelte und verwendet vorhandene Werke", async () => {
    const u = await makeUser("Lea");
    const { rows } = parseLibrary(GOODREADS);
    const [steppenwolf, momo] = rows;
    const r1 = await importRows(u, [{ ...steppenwolf, target: "shelf" }, { ...momo, target: "wish" }], { condition: 3, offers: ["lend"] });
    expect(r1.map((r) => r.outcome)).toEqual(["added", "wished"]);
    const [c] = await sql<{ condition: number; title: string }[]>`select c.condition, e.title from copies c join editions e on e.id = c.edition_id where c.owner_id = ${u.id}`;
    expect(c).toEqual({ condition: 3, title: "Der Steppenwolf" });
    // Zweiter Import derselben Datei: nichts doppelt
    const r2 = await importRows(u, [{ ...steppenwolf, target: "shelf" }, { ...momo, target: "wish" }], {});
    expect(r2.map((r) => r.outcome)).toEqual(["duplicate", "duplicate"]);
    // Eine andere Person mit «Momo» ohne ISBN findet das vorhandene Werk statt eines neuen
    const v = await makeUser("Ben");
    await importRows(v, [{ ...momo, target: "shelf" }], {});
    const [w] = await sql<{ n: number }[]>`select count(*)::int as n from works where title = 'Momo'`;
    expect(w.n).toBe(1);
  });

  it("abgeschaltete Wunschliste: Wünsche werden abgelehnt", async () => {
    const u = await makeUser("Lea");
    await sql`update features set enabled = false where key = 'wishlist'`;
    const { rows } = parseLibrary(GOODREADS);
    await expect(importRows(u, [{ ...rows[1], target: "wish" }], {})).rejects.toMatchObject({ status: 403 });
  });
});
