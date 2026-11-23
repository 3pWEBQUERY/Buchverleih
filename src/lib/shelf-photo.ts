/**
 * Regalfoto-Erkennung (PRD 7.1, Phase 3): Ein Foto eines Regalbretts, Claude liest die Buchrücken,
 * die Titel werden im Katalog gesucht und zur Bestätigung vorgeschlagen. Nichts wird ohne Bestätigung
 * ins Regal gestellt. Ohne ANTHROPIC_API_KEY ist die Funktion abgeschaltet.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { err } from "@/lib/errors";
import { suggestEditions, type Edition } from "@/lib/catalog/works";
import { searchExternal, type ExternalHit } from "@/lib/catalog/lookup";

export const shelfPhotoEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const Spines = z.object({
  books: z.array(z.object({
    title: z.string().describe("Titel, so wie er auf dem Buchrücken steht"),
    author: z.string().nullable().describe("Autorin oder Autor, falls lesbar, sonst null"),
    confidence: z.enum(["high", "medium", "low"]).describe("Wie sicher der Titel gelesen ist"),
  })),
});
export type Spine = z.infer<typeof Spines>["books"][number];

const PROMPT = `Das Foto zeigt ein Regalbrett mit Büchern. Lies jeden Buchrücken (und jedes Buch, dessen Vorderseite sichtbar ist) von links nach rechts.
Gib pro Buch den Titel und die Autorin oder den Autor so zurück, wie sie gedruckt sind – auch wenn der Text gedreht oder in einer anderen Sprache ist.
Lass Verlagsnamen, Reihentitel und Bandnummern weg, ausser sie gehören zum Titel. Erfinde nichts: Was du nicht lesen kannst, lässt du weg.
Wenn auf dem Foto keine Bücher zu sehen sind, gib eine leere Liste zurück.`;

/** Buchrücken lesen. Bild als Base64 (JPEG, PNG oder WebP). */
export async function readSpines(base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<Spine[]> {
  if (!shelfPhotoEnabled()) throw err.conflict("shelf_photo_off", "Die Regalfoto-Erkennung ist noch nicht eingerichtet.");
  let res;
  try {
    res = await anthropic().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Lehnt das Modell ab, übernimmt serverseitig das empfohlene Ersatzmodell
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: betaZodOutputFormat(Spines) },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw err.tooMany("Die Erkennung ist gerade ausgelastet. Versuch es in einer Minute nochmals.");
    if (e instanceof Anthropic.BadRequestError) throw err.invalid("Dieses Foto können wir nicht lesen. Versuch es mit einem anderen.");
    if (e instanceof Anthropic.APIError) {
      console.error("[shelf-photo]", e.status, e.message);
      throw err.conflict("shelf_photo_failed", "Die Erkennung hat gerade nicht geklappt. Versuch es nochmals.");
    }
    throw e;
  }
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw err.conflict("shelf_photo_failed", "Die Erkennung hat gerade nicht geklappt. Versuch es nochmals.");
  }
  return res.parsed_output.books.filter((b) => b.title.trim().length > 1).slice(0, 40);
}

export type SpineMatch = {
  spine: Spine;
  /** Treffer im eigenen Katalog (direkt übernehmbar) */
  edition: Pick<Edition, "id" | "work_id" | "title" | "authors" | "cover_key" | "cover_color" | "year"> | null;
  /** sonst ein Treffer ausserhalb (wird über die ISBN übernommen) */
  external: Pick<ExternalHit, "isbn13" | "title" | "authors" | "year" | "thumb"> | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const similar = (a: string, b: string) => {
  const x = norm(a.split(/[:.(]/)[0]);
  const y = norm(b.split(/[:.(]/)[0]);
  return Boolean(x && y) && (x === y || x.startsWith(y) || y.startsWith(x));
};

/** Gelesene Titel im Katalog suchen: zuerst im eigenen, sonst ausserhalb */
export async function matchSpines(spines: Spine[], locale = "de"): Promise<SpineMatch[]> {
  return Promise.all(spines.map(async (spine) => {
    const q = `${spine.title} ${spine.author ?? ""}`.trim();
    const own = await suggestEditions(q, 5).catch(() => []);
    const hit = own.find((e) => similar(e.title, spine.title)) ?? null;
    if (hit) return { spine, edition: { id: hit.id, work_id: hit.work_id, title: hit.title, authors: hit.authors, cover_key: hit.cover_key, cover_color: hit.cover_color, year: hit.year }, external: null };
    const ext = await searchExternal(q, 5, locale).catch(() => []);
    const x = ext.find((h) => similar(h.title, spine.title)) ?? null;
    return { spine, edition: null, external: x && { isbn13: x.isbn13, title: x.title, authors: x.authors, year: x.year, thumb: x.thumb } };
  }));
}
