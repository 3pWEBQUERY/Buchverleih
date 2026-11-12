/**
 * Titeldaten aus externen Quellen (PRD 7.2). Reihenfolge: eigene Datenbank,
 * Deutsche Nationalbibliothek, Open Library, Google Books. Einmal geladene Titel
 * werden nicht erneut abgefragt; auch Fehltreffer werden 30 Tage gemerkt.
 */
import { sql } from "@/lib/db";
import { env } from "@/lib/env";

export type CatalogRecord = {
  isbn13: string;
  title: string;
  subtitle?: string | null;
  authors: string[];
  publisher?: string | null;
  year?: number | null;
  language?: string | null;
  pages?: number | null;
  genre?: string | null;
  binding?: "hardcover" | "paperback" | "other" | null;
  coverUrl?: string | null;    // nur, wenn die Quelle frei nutzbar ist und aktiviert wurde
  source: "dnb" | "openlibrary" | "google";
};

const LANG: Record<string, string> = { ger: "de", deu: "de", eng: "en", fre: "fr", fra: "fr", ita: "it", spa: "es", roh: "rm" };
const UA = { "user-agent": "Leihregal/0.1 (Buchverleih unter Privatpersonen)" };

async function fetchText(url: string, ms = 6000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function tags(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1].trim()));
  return out;
}

/** «Kafka, Franz [Verfasser]» → «Franz Kafka» */
export function personName(raw: string) {
  const s = raw.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().replace(/[,;]$/, "");
  const m = /^([^,]+),\s*(.+)$/.exec(s);
  return m ? `${m[2].trim()} ${m[1].trim()}` : s;
}

/** DNB-Titel «Der Process : Roman / Franz Kafka» → Titel und Untertitel */
export function splitDnbTitle(raw: string) {
  // «[The Last Daughter] ; Die verschwiegene Tochter : Roman / Soraya Lane»
  // → Originaltitel in eckigen Klammern entfernen, erster Titel vor « ; » zählt
  const main = raw.split(" / ")[0].replace(/^\s*\[[^\]]*\]\s*[;:.]?\s*/, "");
  const first = main.split(" ; ")[0];
  const [title, ...rest] = first.split(" : ");
  return { title: title.replace(/[\[\]]/g, "").trim(), subtitle: rest.join(" : ").trim() || null };
}

async function fromDnb(isbn: string): Promise<CatalogRecord | null> {
  const url = `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D${isbn}&recordSchema=oai_dc&maximumRecords=1`;
  const xml = await fetchText(url);
  const rec = tags(xml, "record")[0] ?? (xml.includes("dc:title") ? xml : null);
  if (!rec) return null;
  const titleRaw = tags(rec, "dc:title")[0];
  if (!titleRaw) return null;
  const { title, subtitle } = splitDnbTitle(titleRaw);
  const authors = tags(rec, "dc:creator").map(personName).filter(Boolean);
  const pub = tags(rec, "dc:publisher")[0];
  const year = Number((tags(rec, "dc:date")[0] ?? "").match(/\d{4}/)?.[0]) || null;
  const lang = tags(rec, "dc:language")[0];
  const format = tags(rec, "dc:format").join(" ");
  const pages = Number(format.match(/(\d+)\s*S\./)?.[1]) || null;
  return {
    isbn13: isbn,
    title,
    subtitle,
    authors,
    publisher: pub ? pub.split(" : ").pop()!.trim() : null,
    year,
    language: lang ? (LANG[lang] ?? lang) : null,
    pages,
    binding: /kart|Taschenbuch|Paperback/i.test(format) ? "paperback" : /Pp\.|Gb\.|Hardcover|geb\./i.test(format) ? "hardcover" : null,
    source: "dnb",
  };
}

async function fromOpenLibrary(isbn: string, withCover: boolean): Promise<CatalogRecord | null> {
  const json = JSON.parse(await fetchText(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`));
  const d = json[`ISBN:${isbn}`];
  if (!d?.title) return null;
  return {
    isbn13: isbn,
    title: d.title,
    subtitle: d.subtitle ?? null,
    authors: (d.authors ?? []).map((a: { name: string }) => a.name),
    publisher: d.publishers?.[0]?.name ?? null,
    year: Number(String(d.publish_date ?? "").match(/\d{4}/)?.[0]) || null,
    pages: d.number_of_pages ?? null,
    coverUrl: withCover ? (d.cover?.large ?? d.cover?.medium ?? null) : null,
    source: "openlibrary",
  };
}

async function fromGoogle(isbn: string): Promise<CatalogRecord | null> {
  const key = env.googleBooksKey ? `&key=${encodeURIComponent(env.googleBooksKey)}` : "";
  const json = JSON.parse(await fetchText(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`));
  const v = json.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  return {
    isbn13: isbn,
    title: v.title,
    subtitle: v.subtitle ?? null,
    authors: v.authors ?? [],
    publisher: v.publisher ?? null,
    year: Number(String(v.publishedDate ?? "").slice(0, 4)) || null,
    language: v.language ?? null,
    pages: v.pageCount ?? null,
    genre: v.categories?.[0] ?? null,
    source: "google",
  };
}

/** Fragt die Quellen der Reihe nach ab und ergänzt fehlende Felder aus späteren Quellen. */
export async function lookupExternal(isbn: string, opts: { covers: boolean }): Promise<CatalogRecord | null> {
  const [cached] = await sql<{ found: boolean; payload: CatalogRecord | null; fetched_at: Date }[]>`
    select found, payload, fetched_at from catalog_lookups where isbn13 = ${isbn}`;
  if (cached && (cached.found || cached.fetched_at > new Date(Date.now() - 30 * 86400_000))) {
    return cached.found ? cached.payload : null;
  }

  let rec: CatalogRecord | null = null;
  let failures = 0;
  const sources = [() => fromDnb(isbn), () => fromOpenLibrary(isbn, opts.covers), () => fromGoogle(isbn)];
  for (const src of sources) {
    try {
      const r = await src();
      if (!r) continue;
      if (!rec) rec = r;
      else {
        rec.language ??= r.language;
        rec.pages ??= r.pages;
        rec.genre ??= r.genre;
        rec.year ??= r.year;
        rec.coverUrl ??= r.coverUrl;
        if (!rec.authors.length) rec.authors = r.authors;
      }
      if (rec.language && rec.authors.length && (rec.coverUrl || !opts.covers)) break;
    } catch (e) {
      failures++;
      console.warn("[catalog]", (e as Error).message);
    }
  }

  // Waren Quellen nicht erreichbar, ist «nicht gefunden» nicht sicher: nichts speichern, beim nächsten Mal neu fragen
  if (!rec && failures > 0) return null;

  await sql`
    insert into catalog_lookups (isbn13, found, source, payload, fetched_at)
    values (${isbn}, ${Boolean(rec)}, ${rec?.source ?? null}, ${rec ? sql.json(rec as never) : null}, now())
    on conflict (isbn13) do update set found = excluded.found, source = excluded.source, payload = excluded.payload, fetched_at = now()`;
  return rec;
}
