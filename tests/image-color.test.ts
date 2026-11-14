/** Dominante Farbe: Bestimmung aus dem Bild und Speicherung beim Verarbeiten von Fotos und Covern. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const objects: Record<string, Buffer> = {};
vi.mock("@/lib/storage", () => ({
  keys: { cover: (isbn: string) => `covers/${isbn}` },
  putObject: vi.fn(async (key: string, body: Buffer) => { objects[key] = body; }),
  getObjectBytes: vi.fn(async (key: string) => {
    if (!objects[key]) throw new Error("NoSuchKey");
    return objects[key];
  }),
  deleteObject: vi.fn(async (key: string) => { delete objects[key]; }),
}));
const images: Record<string, Buffer | null> = {};
vi.mock("@/lib/catalog/covers", () => ({
  coverCandidates: vi.fn(async () => ["https://a.example/cover"]),
  fetchImage: vi.fn(async (url: string) => images[url] ?? null),
}));

import { sql } from "@/lib/db";
import { nextJob, runJob } from "@/worker/jobs";
import { dominantColor } from "@/worker/image-color";
import { addPhoto, listShelf } from "@/lib/copies";
import { makeCopy, makeUser, reset } from "./helpers";

beforeEach(async () => {
  await reset();
  for (const k of Object.keys(objects)) delete objects[k];
});
afterAll(() => sql.end());

const solid = (background: string, width = 300, height = 450) => sharp({ create: { width, height, channels: 3, background } });
const HEX = /^#[0-9a-f]{6}$/;
/** sharp fasst Farben in 4096 Töpfe zusammen: pro Kanal höchstens 16 Stufen Abweichung */
function near(hex: string | null, want: string) {
  expect(hex).toMatch(HEX);
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [ch(hex!), ch(want)];
  for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(16);
}
async function runAll() {
  for (let job = await nextJob(); job; job = await nextJob()) await runJob(job);
}

describe("Dominante Farbe", () => {
  it("liefert für ein einfarbiges Bild dessen Farbe als #rrggbb", async () => {
    near(await dominantColor(await solid("#2e4a3b").png().toBuffer()), "#2e4a3b");
    near(await dominantColor(await solid("#a8822e").jpeg().toBuffer()), "#a8822e");
    near(await dominantColor(await solid("#ffffff", 2400, 3600).webp().toBuffer()), "#ffffff");
  });

  it("nimmt bei gemischten Bildern die häufigste Farbe und bei Transparenz Weiss", async () => {
    const stripe = await solid("#22324a", 300, 60).png().toBuffer();
    near(await dominantColor(await solid("#9e4c2f").composite([{ input: stripe, top: 0, left: 0 }]).png().toBuffer()), "#9e4c2f");
    const clear = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    near(await dominantColor(clear), "#ffffff");
  });

  it("gibt null zurück, wenn die Datei kein Bild ist", async () => {
    expect(await dominantColor(Buffer.from("kein Bild"))).toBeNull();
  });
});

describe("Speicherung beim Verarbeiten", () => {
  it("Foto: Farbe steht am Upload und am Exemplarfoto, und die Regalabfrage liefert sie", async () => {
    const marc = await makeUser("Marc");
    const copy = await makeCopy(marc, "Stiller");
    const key = `u/${marc.id}/copies/${copy}/foto`;
    const raw = `raw/${marc.id}/foto`;
    objects[raw] = await solid("#6d2b2a", 1200, 1800).jpeg().toBuffer();
    const [up] = await sql<{ id: string }[]>`
      insert into uploads (user_id, purpose, raw_key, key, content_type, max_bytes, status)
      values (${marc.id}, 'copy_photo', ${raw}, ${key}, 'image/jpeg', 500000, 'uploaded') returning id`;
    // Foto schon vor der Verarbeitung angehängt: Farbe kommt mit der Verarbeitung nach
    await addPhoto(marc.id, copy, up.id);
    expect((await listShelf(marc.id))[0]).toMatchObject({ photo_key: key, photo_color: null, cover_color: null });

    await sql`insert into jobs (kind, payload) values ('process_upload', ${sql.json({ uploadId: up.id })})`;
    await runAll();
    const [u] = await sql<{ status: string; color: string }[]>`select status, color from uploads where id = ${up.id}`;
    expect(u.status).toBe("processed");
    near(u.color, "#6d2b2a");
    const [ph] = await sql<{ color: string }[]>`select color from copy_photos where copy_id = ${copy}`;
    expect(ph.color).toBe(u.color);
    expect((await listShelf(marc.id))[0].photo_color).toBe(u.color);

    // Nach der Verarbeitung angehängt: die Farbe wird vom Upload übernommen
    const other = await makeCopy(marc, "Homo faber");
    await sql`update uploads set key = ${key + "-2"} where id = ${up.id}`;
    await addPhoto(marc.id, other, up.id);
    const [ph2] = await sql<{ color: string }[]>`select color from copy_photos where copy_id = ${other}`;
    expect(ph2.color).toBe(u.color);
  });

  it("Originalcover: Farbe steht an der Ausgabe", async () => {
    images["https://a.example/cover"] = await solid("#2b5a5b", 400, 620).jpeg().toBuffer();
    const [w] = await sql<{ id: string }[]>`insert into works (work_key, title, authors) values ('t|x', 'Test', '{X}') returning id`;
    const [e] = await sql<{ id: string }[]>`insert into editions (work_id, isbn13, title, source) values (${w.id}, '9783150093189', 'Test', 'manual') returning id`;
    await sql`insert into jobs (kind, payload) values ('cache_cover', ${sql.json({ editionId: e.id, isbn: "9783150093189" })})`;
    await runAll();
    const [ed] = await sql<{ cover_key: string; cover_color: string }[]>`select cover_key, cover_color from editions where id = ${e.id}`;
    expect(ed.cover_key).toBe("covers/9783150093189");
    near(ed.cover_color, "#2b5a5b");
  });

  it("Nachtrag: bestehende Bilder bekommen ihre Farbe in Schritten, fehlende Dateien werden übersprungen", async () => {
    const marc = await makeUser("Marc");
    const [w] = await sql<{ id: string }[]>`insert into works (work_key, title, authors) values ('n|x', 'Nachtrag', '{X}') returning id`;
    const small = await solid("#384a6b", 320, 480).webp().toBuffer();
    // 25 Cover (mehr als ein Schritt), eines davon ohne Datei, eines schon mit Farbe
    for (let i = 0; i < 25; i++) {
      const key = `covers/alt-${i}`;
      if (i !== 7) objects[`${key}-480.webp`] = small;
      await sql`insert into editions (work_id, title, source, cover_key, cover_color) values (${w.id}, ${"Alt " + i}, 'manual', ${key}, ${i === 3 ? "#000000" : null})`;
    }
    const copy = await makeCopy(marc, "Mit Foto");
    objects["u/x/foto-480.webp"] = await solid("#8c2f39", 320, 480).webp().toBuffer();
    await sql`insert into copy_photos (copy_id, key) values (${copy}, 'u/x/foto')`;

    await sql`insert into jobs (kind) values ('backfill_image_colors')`;
    await runAll();
    const eds = await sql<{ cover_key: string; cover_color: string | null }[]>`select cover_key, cover_color from editions where cover_key like 'covers/alt-%'`;
    expect(eds).toHaveLength(25);
    for (const e of eds) {
      if (e.cover_key === "covers/alt-7") expect(e.cover_color).toBeNull();
      else if (e.cover_key === "covers/alt-3") expect(e.cover_color).toBe("#000000");
      else near(e.cover_color, "#384a6b");
    }
    const [ph] = await sql<{ color: string }[]>`select color from copy_photos where copy_id = ${copy}`;
    near(ph.color, "#8c2f39");
    // In Schritten gelaufen und fertig: nichts mehr offen, kein Job gescheitert
    const jobs = await sql<{ done: boolean; last_error: string | null }[]>`select done_at is not null as done, last_error from jobs where kind = 'backfill_image_colors'`;
    expect(jobs.length).toBe(2);
    expect(jobs.every((j) => j.done && !j.last_error)).toBe(true);
    // Wiederholbar: ein weiterer Lauf ändert nichts
    await sql`insert into jobs (kind) values ('backfill_image_colors')`;
    await runAll();
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from editions where cover_key like 'covers/alt-%' and cover_color is null`;
    expect(n.n).toBe(1);
  });
});
