/** Titelsuche in externen Katalogen: nur Treffer mit ISBN, Original statt Übersetzung, eigene Sprache zuerst, Bekanntes weg. */
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { searchExternal } from "@/lib/catalog/lookup";

const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });

describe("searchExternal", () => {
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await sql.end(); });

  it("führt Google Books und Open Library zusammen und wählt die passende Ausgabe", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("googleapis")) return json({ items: [
        { volumeInfo: { title: "Elefant", authors: ["Martin Suter"], language: "en", publishedDate: "2018", industryIdentifiers: [{ type: "ISBN_13", identifier: "9780008264291" }] } },
        { volumeInfo: { title: "Ohne ISBN" } },
      ] });
      if (url.includes("search.json")) return json({ docs: [{ key: "/works/W1", title: "Der Goalie bin ig", author_name: ["Pedro Lenz"], editions: { docs: [{ title: "Der Keeper bin ich", language: ["ger"], isbn: ["9783037620243"] }] } }] });
      if (url.includes("/works/W1/editions.json")) return json({ entries: [
        { title: "Der Goalie bin ig", isbn_13: ["9789021403762"], languages: [{ key: "/languages/dut" }] },
        { title: "Der Goalie bin ig", isbn_13: ["9783905825176"], languages: [{ key: "/languages/gsw" }] },
      ] });
      return new Response("", { status: 404 });
    });
    const hits = await searchExternal(`Test ${Math.random()}`, 10, "de");
    expect(hits.map((h) => h.isbn13)).toEqual(["9783905825176", "9780008264291"]);
    expect(hits[0].title).toBe("Der Goalie bin ig");
  });

  it("ein Katalog fällt aus: der andere liefert trotzdem", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("googleapis")) return new Response("quota", { status: 429 });
      return json({ docs: [{ title: "Stiller", author_name: ["Max Frisch"], editions: { docs: [{ title: "Stiller", language: ["ger"], isbn: ["9783518366059"] }] } }] });
    });
    const hits = await searchExternal(`Stiller ${Math.random()}`, 10, "de");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ title: "Stiller", language: "de", source: "openlibrary" });
  });
});
