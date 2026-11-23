/** Regalfoto: ohne Schlüssel abgeschaltet; gelesene Titel werden im eigenen Katalog gefunden. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { matchSpines, readSpines } from "@/lib/shelf-photo";
import { makeCopy, makeUser, reset } from "./helpers";

vi.mock("@/lib/catalog/lookup", async (orig) => ({
  ...(await orig<typeof import("@/lib/catalog/lookup")>()),
  searchExternal: async () => [{ isbn13: "9783150000014", title: "Faust. Der Tragödie erster Teil", authors: ["Johann Wolfgang von Goethe"], year: 2000, publisher: null, language: "de", thumb: null, source: "openlibrary" }],
}));

beforeEach(reset);
afterAll(() => sql.end());

describe("Regalfoto", () => {
  it("ohne ANTHROPIC_API_KEY abgeschaltet", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(readSpines("abc", "image/jpeg")).rejects.toMatchObject({ code: "shelf_photo_off" });
    if (key) process.env.ANTHROPIC_API_KEY = key;
  });

  it("findet Titel zuerst im eigenen Katalog, sonst ausserhalb, und markiert Unbekanntes", async () => {
    const u = await makeUser("Marc");
    await makeCopy(u, "Der Steppenwolf");
    const m = await matchSpines([
      { title: "DER STEPPENWOLF", author: "Hesse", confidence: "high" },
      { title: "Faust", author: "Goethe", confidence: "medium" },
      { title: "Unlesbar Xyz", author: null, confidence: "low" },
    ]);
    expect(m[0].edition?.title).toBe("Der Steppenwolf");
    expect(m[1].edition).toBeNull();
    expect(m[1].external?.isbn13).toBe("9783150000014");
    expect(m[2].external).toBeNull();
  });
});
