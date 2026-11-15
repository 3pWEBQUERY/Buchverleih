/**
 * Titeldaten aus externen Quellen (PRD 7.2). Reihenfolge: eigene Datenbank,
 * Deutsche Nationalbibliothek, Open Library, Google Books. Einmal geladene Titel
 * werden nicht erneut abgefragt; auch Fehltreffer werden 30 Tage gemerkt.
 */
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizeIsbn } from "./isbn";

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

/** Treffer der Titelsuche in externen Katalogen: nur mit ISBN, damit die Ausgabe sauber übernommen werden kann */
export type ExternalHit = {
  isbn13: string;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  language: string | null;
  /** Vorschaubild der Quelle (nur zur Anzeige; das Original-Cover lädt der Worker nach der Übernahme) */
  thumb: string | null;
  source: "google" | "openlibrary";
};

const searchCache = new Map<string, { at: number; hits: ExternalHit[] }>();

/**
 * Titelsuche in Google Books und Open Library, wenn unser Katalog nichts hat.
 * Ergebnisse nach ISBN-13 zusammengeführt; Ausgaben ohne ISBN fallen weg. 10 Minuten im Speicher gehalten.
 */
export async function searchExternal(q: string, limit = 12, locale = "de"): Promise<ExternalHit[]> {
  const needle = q.trim().replace(/\s+/g, " ");
  if (needle.length < 2) return [];
  const ck = `${locale}:${needle.toLowerCase()}`;
  /** Ausgaben in der Sprache der Person zuerst (Open-Library-Codes) */
  const prefer: Record<string, string[]> = { de: ["ger", "gsw"], fr: ["fre"], it: ["ita"], en: ["eng"] };
  const wanted = prefer[locale] ?? prefer.de;
  const c = searchCache.get(ck);
  if (c && Date.now() - c.at < 10 * 60_000) return c.hits;

  const google = async (): Promise<ExternalHit[]> => {
    const key = env.googleBooksKey ? `&key=${encodeURIComponent(env.googleBooksKey)}` : "";
    const json = JSON.parse(await fetchText(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(needle)}&printType=books&maxResults=20${key}`));
    return (json.items ?? []).flatMap((it: { volumeInfo?: Record<string, unknown> }) => {
      const v = (it.volumeInfo ?? {}) as { title?: string; subtitle?: string; authors?: string[]; publishedDate?: string; publisher?: string; language?: string;
        industryIdentifiers?: { type: string; identifier: string }[]; imageLinks?: { thumbnail?: string; smallThumbnail?: string } };
      const raw = v.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ?? v.industryIdentifiers?.find((x) => x.type === "ISBN_10")?.identifier;
      const isbn = raw ? normalizeIsbn(raw) : null;
      if (!isbn || !v.title) return [];
      const thumb = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null)?.replace(/^http:/, "https:") ?? null;
      return [{ isbn13: isbn, title: v.subtitle ? `${v.title}. ${v.subtitle}` : v.title, authors: v.authors ?? [], year: Number(String(v.publishedDate ?? "").slice(0, 4)) || null,
        publisher: v.publisher ?? null, language: v.language ?? null, thumb, source: "google" as const }];
    });
  };
  /**
   * Open Library: ein Werk hat ISBN aller Ausgaben in allen Sprachen. Darum die am besten passende
   * Ausgabe (editions) nehmen – mit ihrer eigenen ISBN, ihrem Titel und Cover.
   */
  /** Open Library antwortet manchmal mit abgebrochener Verbindung: einmal nachfassen */
  const olText = async (url: string) => { try { return await fetchText(url, 9000); } catch { return await fetchText(url, 9000); } };
  const openLibrary = async (): Promise<ExternalHit[]> => {
    const fields = "key,title,author_name,first_publish_year,editions,editions.title,editions.isbn,editions.language,editions.publisher,editions.cover_i,editions.publish_date";
    const json = JSON.parse(await olText(`https://openlibrary.org/search.json?q=${encodeURIComponent(needle)}&limit=12&fields=${fields}`));
    type Ed = { title?: string; isbn?: string[]; isbn_13?: string[]; isbn_10?: string[]; language?: (string | { key: string })[]; languages?: { key: string }[]; publisher?: string[]; publishers?: string[]; cover_i?: number; covers?: number[]; publish_date?: string | string[] };
    type Doc = { key?: string; title?: string; author_name?: string[]; first_publish_year?: number; editions?: { docs?: Ed[] } };
    const flat = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const isbnOf = (e: Ed) => [...(e.isbn ?? []), ...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])].map((x) => normalizeIsbn(x)).find(Boolean) ?? null;
    const codes = (e: Ed) => [...(e.language ?? []), ...(e.languages ?? [])].map((x) => (typeof x === "string" ? x : x.key.split("/").pop() ?? ""));
    const preferred = (e: Ed) => codes(e).some((c) => wanted.includes(c));
    const langOf = (e: Ed) => { const x = e.language?.[0] ?? e.languages?.[0]; const code = typeof x === "string" ? x : x?.key?.split("/").pop(); return code ? LANG[code] ?? null : null; };
    /** Aus allen Ausgaben des Werks die mit dem Werktitel (Original statt Übersetzung) */
    const fromWork = async (d: Doc): Promise<Ed | null> => {
      if (!d.key) return null;
      const all = (JSON.parse(await olText(`https://openlibrary.org${d.key}/editions.json?limit=50`)).entries ?? []) as Ed[];
      const withIsbn = all.filter((e) => isbnOf(e));
      const t = d.title ? flat(d.title) : "";
      const matches = withIsbn.filter((e) => t && e.title && flat(e.title).startsWith(t));
      return matches.find(preferred) ?? matches[0] ?? null;
    };
    const docs = (json.docs ?? []) as Doc[];
    const out = await Promise.all(docs.map(async (d, i): Promise<ExternalHit | null> => {
      let e: Ed | null = d.editions?.docs?.find((x) => isbnOf(x)) ?? null;
      // Die gefundene Ausgabe ist eine Übersetzung oder Neuausgabe mit anderem Titel: lieber die Ausgabe mit dem Werktitel
      const sameTitle = e?.title && d.title && flat(e.title).startsWith(flat(d.title));
      // Übersetzung, andere Ausgabe oder andere Sprache gefunden: unter allen Ausgaben des Werks die passendere suchen
      if ((!e || !sameTitle || !preferred(e)) && i < 4) {
        const w = await fromWork(d).catch(() => null);
        if (w && (!e || preferred(w) || !sameTitle)) e = w;
      }
      // Nichts mit dem Werktitel und keine passende Ausgabe: irgendeine Ausgabe des Werks mit ISBN
      if (!e && i < 4 && d.key) e = ((JSON.parse(await olText(`https://openlibrary.org${d.key}/editions.json?limit=20`).catch(() => "{}")).entries ?? []) as Ed[]).find((x) => isbnOf(x)) ?? null;
      const isbn = e ? isbnOf(e) : null;
      if (!e || !isbn) return null;
      const cover = e.cover_i ?? e.covers?.find((c) => c > 0);
      const date = Array.isArray(e.publish_date) ? e.publish_date[0] : e.publish_date;
      return { isbn13: isbn, title: e.title ?? d.title ?? "", authors: d.author_name ?? [],
        year: Number(String(date ?? "").match(/\d{4}/)?.[0]) || d.first_publish_year || null,
        publisher: (e.publisher ?? e.publishers)?.[0] ?? null, language: langOf(e),
        thumb: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null, source: "openlibrary" as const };
    }));
    return out.filter((h): h is ExternalHit => Boolean(h && h.title));
  };

  const settled = await Promise.allSettled([google(), openLibrary()]);
  for (const s of settled) if (s.status === "rejected") console.warn("[catalog-search]", (s.reason as Error).message);
  const seen = new Set<string>();
  const hits: ExternalHit[] = [];
  // Google zuerst (meist bessere Cover und Sprachangaben), dann ergänzend Open Library
  for (const s of settled) if (s.status === "fulfilled") for (const h of s.value) {
    if (seen.has(h.isbn13)) continue;
    seen.add(h.isbn13);
    hits.push(h);
  }
  // Was wir schon haben, kommt aus der eigenen Suche; hier nur Neues zeigen
  const have = hits.length ? new Set((await sql<{ isbn13: string }[]>`select isbn13 from editions where isbn13 = any(${hits.map((h) => h.isbn13)})`).map((r) => r.isbn13)) : new Set<string>();
  // Ausgaben in der Sprache der Person zuerst, dann ohne Angabe, dann andere Sprachen (Reihenfolge sonst wie geliefert)
  const rank = (h: ExternalHit) => (h.language === locale ? 0 : h.language == null ? 1 : 2);
  const out = hits.filter((h) => !have.has(h.isbn13)).map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i).map((x) => x.h).slice(0, limit);
  if (settled.some((s) => s.status === "fulfilled")) {
    searchCache.set(ck, { at: Date.now(), hits: out });
    if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value!);
  }
  return out;
}
