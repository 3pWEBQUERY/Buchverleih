/**
 * Import der eigenen Bibliothek aus Goodreads oder StoryGraph (PRD 7.1, Phase 2).
 *
 * Ablauf: Die CSV-Datei wird gelesen und als Vorschau zurückgegeben (nichts gespeichert). Die Person
 * wählt pro Buch «ins Regal», «auf die Wunschliste» oder «überspringen». Die gewählten Zeilen kommen
 * in kleinen Paketen zurück; jedes Buch wird über die ISBN im Katalog gefunden (samt Original-Cover),
 * sonst über Titel und Autor, und nur wenn gar nichts passt von Hand angelegt.
 */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { normalizeIsbn } from "@/lib/catalog/isbn";
import { createManualEdition, editionByIsbn, suggestEditions, type Edition } from "@/lib/catalog/works";
import { searchExternal } from "@/lib/catalog/lookup";
import { addCopy, type CopySettings } from "@/lib/copies";
import { entitlements } from "@/lib/trust";
import { requireFeature } from "@/lib/features";

export type ImportStatus = "read" | "reading" | "to-read" | "dnf" | "other";
export type ImportRow = {
  key: string;
  title: string;
  authors: string[];
  isbn13: string | null;
  status: ImportStatus;
  /** Besitz laut Export: true, false oder unbekannt */
  owned: boolean | null;
  year: number | null;
};
export type ImportFormat = "goodreads" | "storygraph";
export const MAX_ROWS = 3000;

// ---------------------------------------------------------------------------
// CSV lesen (RFC 4180: Anführungszeichen, Zeilenumbrüche in Feldern, verdoppelte "")
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Goodreads schreibt ISBN als ="9783..." damit Tabellenprogramme sie nicht als Zahl lesen */
function cleanIsbn(v: string | undefined) {
  if (!v) return null;
  const raw = v.replace(/^=?"?|"?$/g, "").replace(/[^0-9Xx]/g, "");
  return raw ? normalizeIsbn(raw) : null;
}

function splitAuthors(...vals: (string | undefined)[]) {
  const out: string[] = [];
  for (const v of vals) for (const a of (v ?? "").split(/,(?![^()]*\))/)) {
    const n = a.trim().replace(/\s+/g, " ");
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 5);
}

const year = (v: string | undefined) => {
  const m = /\b(1[4-9]\d\d|20\d\d)\b/.exec(v ?? "");
  return m ? Number(m[1]) : null;
};

export function parseLibrary(text: string): { format: ImportFormat; rows: ImportRow[] } {
  const table = parseCsv(text);
  if (table.length < 2) throw err.invalid("Die Datei enthält keine Bücher.");
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const get = (r: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? r[i]?.trim() : undefined;
  };
  let format: ImportFormat;
  if (col("exclusive shelf") >= 0 && col("isbn13") >= 0) format = "goodreads";
  else if (col("isbn/uid") >= 0 && col("read status") >= 0) format = "storygraph";
  else throw err.invalid("Diese Datei kennen wir nicht. Lade den CSV-Export aus Goodreads oder StoryGraph hoch.");

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  for (const r of table.slice(1, MAX_ROWS + 1)) {
    const title = (get(r, "title") ?? "").replace(/\s+/g, " ").slice(0, 200);
    if (!title) continue;
    let row: Omit<ImportRow, "key">;
    if (format === "goodreads") {
      const shelf = (get(r, "exclusive shelf") ?? "").toLowerCase();
      const owned = Number(get(r, "owned copies") ?? "0");
      row = {
        title,
        authors: splitAuthors(get(r, "author"), get(r, "additional authors")),
        isbn13: cleanIsbn(get(r, "isbn13")) ?? cleanIsbn(get(r, "isbn")),
        status: shelf === "read" ? "read" : shelf === "currently-reading" ? "reading" : shelf === "to-read" ? "to-read" : "other",
        owned: owned > 0 ? true : null,
        year: year(get(r, "year published")) ?? year(get(r, "original publication year")),
      };
    } else {
      const st = (get(r, "read status") ?? "").toLowerCase();
      const owned = (get(r, "owned?") ?? "").toLowerCase();
      row = {
        title,
        authors: splitAuthors(get(r, "authors")),
        isbn13: cleanIsbn(get(r, "isbn/uid")),
        status: st === "read" ? "read" : st === "currently-reading" ? "reading" : st === "to-read" ? "to-read" : st === "did-not-finish" ? "dnf" : "other",
        owned: owned === "yes" ? true : owned === "no" ? false : null,
        year: null,
      };
    }
    const key = row.isbn13 ?? `${title.toLowerCase()}|${row.authors[0]?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, ...row });
  }
  if (!rows.length) throw err.invalid("Die Datei enthält keine Bücher.");
  return { format, rows };
}

/** Vorschlag pro Buch: Besitz und Gelesenes ins Regal, «will ich lesen» auf die Wunschliste */
export function suggestTarget(r: ImportRow): "shelf" | "wish" | "skip" {
  if (r.owned === true) return "shelf";
  if (r.status === "to-read") return "wish";
  if (r.owned === false || r.status === "dnf") return "skip";
  if (r.status === "read" || r.status === "reading") return "shelf";
  return "skip";
}

// ---------------------------------------------------------------------------
// Übernehmen
// ---------------------------------------------------------------------------

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Titel passt, wenn der kürzere (ohne Untertitel) im längeren steckt */
function sameTitle(a: string, b: string) {
  const x = norm(a.split(/[:.(]/)[0]);
  const y = norm(b.split(/[:.(]/)[0]);
  return Boolean(x && y) && (x === y || x.startsWith(y) || y.startsWith(x));
}
function sameAuthor(a: string[], b: string[]) {
  if (!a.length || !b.length) return true;
  const last = (n: string) => norm(n).split(" ").pop() ?? "";
  return a.some((x) => b.some((y) => last(x) === last(y)));
}

/** Ausgabe zu einer Importzeile: ISBN, dann eigener Katalog, dann weltweite Titelsuche, sonst von Hand */
export async function resolveEdition(userId: string, r: Pick<ImportRow, "title" | "authors" | "isbn13" | "year">, locale = "de"): Promise<Edition> {
  // ISBN zuerst – aber nur, wenn der Titel dazu passt (Exporte enthalten manchmal die ISBN einer anderen Ausgabe)
  const byIsbn = r.isbn13 ? await editionByIsbn(r.isbn13, userId).catch(() => null) : null;
  if (byIsbn && sameTitle(byIsbn.title, r.title)) return byIsbn;
  const own = await suggestEditions(`${r.title} ${r.authors[0] ?? ""}`.trim(), 5).catch(() => []);
  const hit = own.find((e) => sameTitle(e.title, r.title) && sameAuthor(e.authors, r.authors));
  if (hit) return hit;
  {
    const ext = await searchExternal(`${r.title} ${r.authors[0] ?? ""}`.trim(), 5, locale).catch(() => []);
    const x = ext.find((h) => sameTitle(h.title, r.title) && sameAuthor(h.authors, r.authors));
    if (x) {
      const e = await editionByIsbn(x.isbn13, userId).catch(() => null);
      if (e) return e;
    }
  }
  // Nichts passt: von Hand anlegen, ohne die fremde ISBN (sonst gälte wieder der Katalogeintrag)
  return createManualEdition(userId, { title: r.title, authors: r.authors.length ? r.authors : ["Unbekannt"], year: r.year, isbn: byIsbn ? null : r.isbn13 });
}

export type ImportResult = { key: string; outcome: "added" | "wished" | "duplicate" | "failed"; title?: string; error?: string };

export async function importRows(
  user: { id: string; plan_id: string; radius_km: number },
  rows: (ImportRow & { target: "shelf" | "wish" })[],
  settings: Pick<CopySettings, "condition" | "offers" | "visibility">,
  locale = "de",
): Promise<ImportResult[]> {
  if (rows.some((r) => r.target === "wish")) await requireFeature("wishlist");
  const out: ImportResult[] = [];
  for (const r of rows) {
    try {
      const e = await resolveEdition(user.id, r, locale);
      if (r.target === "shelf") {
        const [dup] = await sql`select 1 from copies c join editions x on x.id = c.edition_id
                                 where c.owner_id = ${user.id} and c.removed_at is null and x.work_id = ${e.work_id} limit 1`;
        if (dup) { out.push({ key: r.key, outcome: "duplicate", title: e.title }); continue; }
        await addCopy(user.id, e.id, { condition: settings.condition ?? 2, offers: settings.offers ?? ["lend"], visibility: settings.visibility });
        out.push({ key: r.key, outcome: "added", title: e.title });
      } else {
        const ent = await entitlements(sql, user.plan_id);
        const [n] = await sql<{ n: number }[]>`select count(*)::int as n from wishlist_items where user_id = ${user.id} and alarm`;
        // Über dem Titelalarm-Kontingent: auf die Liste, aber ohne Alarm
        const alarm = n.n < ent.title_alarms;
        const ins = await sql`
          insert into wishlist_items (user_id, work_id, radius_km, alarm) values (${user.id}, ${e.work_id}, ${user.radius_km}, ${alarm})
          on conflict (user_id, work_id) do nothing returning 1`;
        out.push({ key: r.key, outcome: ins.length ? "wished" : "duplicate", title: e.title });
      }
    } catch (e) {
      out.push({ key: r.key, outcome: "failed", error: (e as Error).message });
    }
  }
  return out;
}
