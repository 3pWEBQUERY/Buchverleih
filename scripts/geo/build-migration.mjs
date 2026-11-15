/**
 * Erzeugt db/migrations/0027_schweiz_gebiete.sql aus den amtlichen Verzeichnissen:
 *  – swisstopo «Amtliches Ortschaftenverzeichnis mit PLZ» (WGS84, CSV):
 *    https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz_4326.csv.zip
 *  – BFS «Amtliches Gemeindeverzeichnis» (Stand Datum, CSV):
 *    https://www.agvchapp.bfs.admin.ch/api/communes/snapshot?date=TT-MM-JJJJ
 *
 *   node scripts/geo/build-migration.mjs <AMTOVZ_CSV_WGS84.csv> <communes.csv> > db/migrations/0027_schweiz_gebiete.sql
 *
 * Eine PLZ kann mehrere Gemeinden berühren: sie gehört zur Gemeinde mit dem grössten Adressenanteil.
 */
import { readFileSync } from "node:fs";

const [plzFile, bfsFile] = process.argv.slice(2);
const csv = (text, sep) => {
  const [head, ...rows] = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cols = head.split(sep);
  return rows.map((line) => {
    const out = []; let cur = ""; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i] ?? ""]));
  });
};
const s = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n6 = (x) => Math.round(x * 1e6) / 1e6;

const plzRows = csv(readFileSync(plzFile, "utf8"), ";");
const bfs = csv(readFileSync(bfsFile, "utf8"), ",");

// Kantone (Level 1), Bezirke (Level 2), Gemeinden (Level 3)
const byHist = new Map(bfs.map((r) => [r.HistoricalCode, r]));
const cantons = bfs.filter((r) => r.Level === "1").map((r) => ({ code: r.ShortName, bfs: Number(r.BfsCode), name: r.Name }));
const cantonOfHist = (h) => { let r = byHist.get(h); while (r && r.Level !== "1") r = byHist.get(r.Parent); return r?.ShortName; };
const districts = bfs.filter((r) => r.Level === "2").map((r) => ({ id: Number(r.BfsCode), canton: cantonOfHist(r.Parent), name: r.Name }));
const communes = new Map();
for (const r of bfs.filter((x) => x.Level === "3")) {
  const parent = byHist.get(r.Parent);
  communes.set(Number(r.BfsCode), {
    bfs: Number(r.BfsCode), name: r.Name, canton: cantonOfHist(r.Parent),
    district: parent?.Level === "2" ? Number(parent.BfsCode) : null, pts: [],
  });
}
// Liechtenstein: nicht im BFS-Verzeichnis, aber Mobilnummern aus FL sind zugelassen
cantons.push({ code: "FL", bfs: 99, name: "Liechtenstein" });
for (const r of plzRows) {
  const nr = Number(r["BFS-Nr"]);
  if (!communes.has(nr) && (r["Kantonskürzel"] === "" && nr >= 7001 && nr <= 7011))
    communes.set(nr, { bfs: nr, name: r.Gemeindename, canton: "FL", district: null, pts: [] });
}

// PLZ: Hauptgemeinde nach Adressenanteil; Koordinaten der Ortschaften dieser Gemeinde gemittelt
const plz = new Map();
for (const r of plzRows) {
  const nr = Number(r["BFS-Nr"]);
  const c = communes.get(nr);
  if (!c) continue;
  const share = parseFloat(r.Adressenanteil) || 0;
  const lat = Number(r.N), lng = Number(r.E);
  c.pts.push([lat, lng]);
  const cur = plz.get(r.PLZ4) ?? { shares: new Map() };
  const sh = cur.shares.get(nr) ?? { share: 0, pts: [] };
  sh.share += share; sh.pts.push([lat, lng]);
  cur.shares.set(nr, sh);
  plz.set(r.PLZ4, cur);
}
const avg = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

const out = [];
out.push(`-- Alle Kantone, Bezirke, Gemeinden und Postleitzahlen der Schweiz (und Liechtenstein) aus den amtlichen
-- Verzeichnissen von swisstopo und BFS; erzeugt mit scripts/geo/build-migration.mjs.
-- Freigabe für Leihregal pro Kanton, Bezirk oder Gemeinde (area_openings): die genaueste Regel gilt.

create table geo_cantons (
  code text primary key,
  bfs  int not null,
  name text not null
);
create table geo_districts (
  id     int primary key,
  canton text not null references geo_cantons (code),
  name   text not null
);
create table geo_communes (
  bfs         int primary key,
  name        text not null,
  canton      text not null references geo_cantons (code),
  district_id int references geo_districts (id),
  lat         double precision,
  lng         double precision
);
create index on geo_communes (canton);
create index on geo_communes (district_id);

alter table postal_codes add column bfs_nr int references geo_communes (bfs);
alter table postal_codes add column canton text references geo_cantons (code);
create index on postal_codes (bfs_nr);
create index on postal_codes (canton);

-- Freigaben: eine Zeile pro gesetzter Regel. Fehlt eine Regel, erbt das Gebiet von der nächsthöheren Ebene.
create table area_openings (
  level      text not null check (level in ('canton', 'district', 'commune')),
  code       text not null,
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users (id) on delete set null,
  primary key (level, code)
);
`);
const chunk = (rows, n = 500) => { const o = []; for (let i = 0; i < rows.length; i += n) o.push(rows.slice(i, i + n)); return o; };
out.push(`insert into geo_cantons (code, bfs, name) values\n${cantons.map((c) => `  (${s(c.code)}, ${c.bfs}, ${s(c.name)})`).join(",\n")};\n`);
out.push(`insert into geo_districts (id, canton, name) values\n${districts.map((d) => `  (${d.id}, ${s(d.canton)}, ${s(d.name)})`).join(",\n")};\n`);
const comm = [...communes.values()].filter((c) => c.canton);
for (const part of chunk(comm)) {
  out.push(`insert into geo_communes (bfs, name, canton, district_id, lat, lng) values\n${part.map((c) => {
    const [la, ln] = c.pts.length ? avg(c.pts) : [null, null];
    return `  (${c.bfs}, ${s(c.name)}, ${s(c.canton)}, ${c.district ?? "null"}, ${la == null ? "null" : n6(la)}, ${ln == null ? "null" : n6(ln)})`;
  }).join(",\n")};\n`);
}
const plzOut = [...plz.entries()].map(([code, v]) => {
  const [nr, best] = [...v.shares.entries()].sort((a, b) => b[1].share - a[1].share)[0];
  const c = communes.get(nr);
  const [la, ln] = avg(best.pts);
  return { code, municipality: c.name, bfs: nr, canton: c.canton, lat: n6(la), lng: n6(ln) };
}).sort((a, b) => a.code.localeCompare(b.code));
for (const part of chunk(plzOut)) {
  out.push(`insert into postal_codes (plz, municipality, bfs_nr, canton, lat, lng) values\n${part.map((p) =>
    `  (${s(p.code)}, ${s(p.municipality)}, ${p.bfs}, ${s(p.canton)}, ${p.lat}, ${p.lng})`).join(",\n")}
on conflict (plz) do update set municipality = excluded.municipality, bfs_nr = excluded.bfs_nr, canton = excluded.canton,
  lat = excluded.lat, lng = excluded.lng;\n`);
}
out.push(`-- Bisher offene Regionen bleiben offen: jede Gemeinde mit einer PLZ in einer offenen Region wird freigegeben.
insert into area_openings (level, code, enabled)
select distinct 'commune', p.bfs_nr::text, true
  from postal_codes p join regions r on r.id = p.region_id
 where r.enabled and p.bfs_nr is not null
on conflict do nothing;

-- Ist diese Postleitzahl für Leihregal offen? Gemeinde vor Bezirk vor Kanton; ohne Regel geschlossen.
create or replace function plz_open(p_plz text) returns boolean language sql stable as $$
  select coalesce((select coalesce(
    (select o.enabled from area_openings o where o.level = 'commune' and o.code = pc.bfs_nr::text),
    (select o.enabled from area_openings o where o.level = 'district' and o.code = gc.district_id::text),
    (select o.enabled from area_openings o where o.level = 'canton' and o.code = pc.canton),
    false)
    from postal_codes pc left join geo_communes gc on gc.bfs = pc.bfs_nr
   where pc.plz = p_plz), false)
$$;
`);
process.stdout.write(out.join("\n"));
