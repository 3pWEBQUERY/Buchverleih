/** Original-Cover: Kandidaten werden der Reihe nach probiert, Platzhalter verworfen, Varianten abgelegt. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const stored: string[] = [];
vi.mock("@/lib/storage", () => ({
  keys: { cover: (isbn: string) => `covers/${isbn}` },
  putObject: vi.fn(async (key: string) => { stored.push(key); }),
  getObjectBytes: vi.fn(),
  deleteObject: vi.fn(),
}));
const images: Record<string, Buffer | null> = {};
vi.mock("@/lib/catalog/covers", () => ({
  coverCandidates: vi.fn(async () => ["https://a.example/placeholder", "https://b.example/real"]),
  fetchImage: vi.fn(async (url: string) => images[url] ?? null),
}));

import { sql } from "@/lib/db";
import { nextJob, runJob } from "@/worker/jobs";
import { reset } from "./helpers";

beforeEach(async () => { await reset(); stored.length = 0; });
afterAll(() => sql.end());

describe("Original-Cover", () => {
  it("überspringt untaugliche Bilder und speichert das Buchcover in vier Varianten", async () => {
    images["https://a.example/placeholder"] = await sharp({ create: { width: 200, height: 60, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    images["https://b.example/real"] = await sharp({ create: { width: 400, height: 620, channels: 3, background: "#2e4a3b" } }).jpeg().toBuffer();
    const [w] = await sql<{ id: string }[]>`insert into works (work_key, title, authors) values ('t|x', 'Test', '{X}') returning id`;
    const [e] = await sql<{ id: string }[]>`insert into editions (work_id, isbn13, title, source) values (${w.id}, '9783150093189', 'Test', 'manual') returning id`;
    await sql`insert into jobs (kind, payload) values ('cache_cover', ${sql.json({ editionId: e.id, isbn: "9783150093189" })})`;
    const job = await nextJob();
    await runJob(job!);
    const [ed] = await sql<{ cover_key: string; cover_w: number; cover_h: number }[]>`select cover_key, cover_w, cover_h from editions where id = ${e.id}`;
    expect(ed.cover_key).toBe("covers/9783150093189");
    expect(ed.cover_h / ed.cover_w).toBeCloseTo(620 / 400, 1);
    expect(stored.sort()).toEqual(["covers/9783150093189-480.avif", "covers/9783150093189-480.webp", "covers/9783150093189.avif", "covers/9783150093189.webp"]);
  });
});
