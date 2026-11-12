"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { IconClose } from "@/components/icons";
import { cx } from "@/components/ui";
import { offerLabel } from "@/lib/i18n/de-CH";
import type { WorkHit } from "@/lib/search";

export type Center = { lat: number; lng: number };

type Spot = { key: string; lat: number; lng: number; free: number; items: { h: WorkHit; free: number }[] };

/** Graue Landeskarte von swisstopo (frei nutzbar mit Quellenangabe); fällt bei Fehlern auf OpenStreetMap zurück */
const SWISSTOPO = "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR_SWISSTOPO = '© <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">swisstopo</a>';
const ATTR_OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

function spotsOf(hits: WorkHit[]): Spot[] {
  const m = new Map<string, Spot>();
  for (const h of hits) {
    for (const [lat, lng, free] of h.cells ?? []) {
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      let s = m.get(key);
      if (!s) m.set(key, (s = { key, lat, lng, free: 0, items: [] }));
      s.items.push({ h, free });
      s.free += free > 0 ? 1 : 0;
    }
  }
  // Freie Titel zuerst, dann alphabetisch
  for (const s of m.values()) s.items.sort((a, b) => Number(b.free > 0) - Number(a.free > 0) || a.h.title.localeCompare(b.h.title, "de"));
  return [...m.values()];
}

type Cluster = { key: string; lat: number; lng: number; cells: Spot[]; titles: number; free: number };

/** Titel mehrerer Gebiete zusammenführen; ein Titel zählt als frei, wenn er irgendwo frei ist */
function mergeItems(cells: Spot[]) {
  const m = new Map<string, { h: WorkHit; free: number }>();
  for (const c of cells) for (const i of c.items) {
    const x = m.get(i.h.work_id);
    if (x) x.free += i.free;
    else m.set(i.h.work_id, { ...i });
  }
  return [...m.values()].sort((a, b) => Number(b.free > 0) - Number(a.free > 0) || a.h.title.localeCompare(b.h.title, "de"));
}

/** Nahe Gebiete je nach Zoomstufe zusammenfassen, damit sich Punkte nicht überdecken */
function clusterSpots(m: L.Map, spots: Spot[], px = 44): Cluster[] {
  const z = m.getZoom();
  const groups: { p: L.Point; cells: Spot[] }[] = [];
  const sorted = [...spots].sort((a, b) => b.items.length - a.items.length);
  for (const s of sorted) {
    const p = m.project([s.lat, s.lng], z);
    const g = groups.find((g) => g.p.distanceTo(p) < px);
    if (g) g.cells.push(s);
    else groups.push({ p, cells: [s] });
  }
  return groups.map(({ cells }) => {
    const items = mergeItems(cells);
    const w = cells.reduce((n, c) => n + c.items.length, 0);
    return {
      key: cells.map((c) => c.key).sort().join("|"),
      lat: cells.reduce((n, c) => n + c.lat * c.items.length, 0) / w,
      lng: cells.reduce((n, c) => n + c.lng * c.items.length, 0) / w,
      cells,
      titles: items.length,
      free: items.filter((i) => i.free > 0).length,
    };
  });
}

function pinIcon(s: { titles: number; free: number }, on: boolean) {
  const n = s.titles;
  const size = n >= 20 ? 46 : n >= 8 ? 40 : n >= 3 ? 34 : 30;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="map-pin${s.free ? " is-free" : ""}${on ? " is-on" : ""}" style="width:${size}px;height:${size}px">${n}</span>`,
  });
}

/**
 * Kartenansicht der Suche. Zeigt Titel pro Gebiet von rund einem Kilometer, nie den genauen Ort
 * eines Regals (PRD 12). Ein Tippen auf ein Gebiet listet die Titel dort.
 */
export default function SearchMap({ hits, center, radiusKm, href, loading }: {
  hits: WorkHit[];
  center: Center | null;
  radiusKm: number;
  href: (h: WorkHit) => string;
  loading: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const ring = useRef<L.LayerGroup | null>(null);
  const spots = useMemo(() => spotsOf(hits), [hits]);
  const [zoom, setZoom] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const selCells = selected ? spots.filter((s) => selected.includes(s.key)) : [];
  const sel = selCells.length ? { items: mergeItems(selCells) } : null;
  const selFree = sel ? sel.items.filter((i) => i.free > 0).length : 0;

  // Karte einmal anlegen
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: false, minZoom: 8, maxZoom: 16, zoomSnap: 0.5, scrollWheelZoom: true });
    L.control.zoom({ position: "bottomleft", zoomInTitle: "Hineinzoomen", zoomOutTitle: "Herauszoomen" }).addTo(m);
    const attribution = L.control.attribution({ prefix: false, position: "bottomright" }).addTo(m);
    let tiles = L.tileLayer(SWISSTOPO, { attribution: ATTR_SWISSTOPO, className: "map-tiles", maxZoom: 16, crossOrigin: true }).addTo(m);
    let loaded = false;
    let errors = 0;
    tiles.on("tileload", () => (loaded = true));
    tiles.on("tileerror", () => {
      if (loaded || ++errors < 3) return;
      m.removeLayer(tiles);
      attribution.removeAttribution(ATTR_SWISSTOPO);
      tiles = L.tileLayer(OSM, { attribution: ATTR_OSM, className: "map-tiles", maxZoom: 16 }).addTo(m);
    });
    m.setView([47.42, 8.55], 11);
    m.on("click", () => setSelected(null));
    m.on("zoomend", () => setZoom(m.getZoom()));
    layer.current = L.layerGroup().addTo(m);
    ring.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Umkreis und eigener Ort
  useEffect(() => {
    const m = map.current;
    if (!m || !ring.current) return;
    ring.current.clearLayers();
    if (!center) {
      if (spots.length) m.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lng])).pad(0.2), { maxZoom: 13 });
      return;
    }
    const c = L.circle([center.lat, center.lng], { radius: radiusKm * 1000, className: "map-ring", interactive: false }).addTo(ring.current);
    L.marker([center.lat, center.lng], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: '<span class="map-home" aria-hidden="true"></span>' }),
    }).addTo(ring.current);
    m.fitBounds(c.getBounds(), { padding: [16, 16] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, radiusKm]);

  // Auswahl verwerfen, wenn die Gebiete nach einer neuen Suche nicht mehr da sind
  useEffect(() => {
    setSelected((k) => (k && k.some((x) => spots.some((s) => s.key === x)) ? k.filter((x) => spots.some((s) => s.key === x)) : null));
  }, [spots]);

  // Punkte (bei jeder Zoomstufe neu zusammengefasst)
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const c of clusterSpots(m, spots)) {
      const on = !!selected && c.cells.some((x) => selected.includes(x.key));
      const title = `${c.titles === 1 ? "1 Titel" : `${c.titles} Titel`}${c.free ? `, ${c.free} jetzt frei` : ""}`;
      L.marker([c.lat, c.lng], { icon: pinIcon(c, on), title, alt: title, riseOnHover: true, zIndexOffset: on ? 1000 : c.free ? 100 : 0 })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          // Mehrere Gebiete unter einem Punkt: erst hineinzoomen, bis sie sich trennen
          if (c.cells.length > 1 && m.getZoom() < m.getMaxZoom() - 1) {
            const b = L.latLngBounds(c.cells.map((x) => [x.lat, x.lng]));
            const next = Math.min(m.getBoundsZoom(b.pad(0.6)), m.getMaxZoom());
            if (next > m.getZoom()) return m.flyTo(b.getCenter(), next, { duration: 0.4 });
          }
          setSelected((k) => (k && k.join("|") === c.cells.map((x) => x.key).join("|") ? null : c.cells.map((x) => x.key)));
        })
        .addTo(g);
    }
  }, [spots, zoom, selected]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const titles = new Set(spots.flatMap((s) => s.items.map((i) => i.h.work_id))).size;

  return (
    <div className="anim-rise">
      <div className="relative rounded-[12px] border border-line overflow-hidden bg-paper-2 isolate">
        <div ref={box} className="search-map h-[62vh] min-h-[420px] max-h-[680px] w-full" role="region" aria-label="Karte der Treffer" />

        <div className={cx("pointer-events-none absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 z-[500] transition-opacity", loading && "opacity-60")}>
          <span className="pointer-events-auto inline-flex items-center gap-2 h-8 px-3 rounded-[6px] bg-paper/95 border border-line text-[13px] font-medium text-ink-2">
            {spots.length === 0 ? "Keine Orte" : <>{titles === 1 ? "1 Titel" : `${titles} Titel`} in {spots.length === 1 ? "1 Gebiet" : `${spots.length} Gebieten`}</>}
          </span>
          <span className="pointer-events-auto hidden sm:inline-flex items-center gap-3 h-8 px-3 rounded-[6px] bg-paper/95 border border-line text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /> jetzt frei</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink-2 bg-paper" /> vergeben</span>
          </span>
        </div>

        {sel && (
          <section aria-label="Titel an diesem Ort"
            className="absolute z-[1100] inset-x-2 bottom-2 max-h-[58%] md:inset-x-auto md:right-3 md:top-3 md:bottom-8 md:max-h-none md:w-[360px] flex flex-col rounded-[10px] border border-line bg-paper anim-rise">
            <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-line">
              <div className="min-w-0">
                <p className="font-medium text-[15px]">{sel.items.length === 1 ? "1 Titel" : `${sel.items.length} Titel`} in diesem Gebiet</p>
                <p className="text-[12.5px] text-muted mt-0.5">{selFree ? `${selFree} jetzt frei · ` : ""}Ort auf rund 1 km gerundet</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Schliessen"
                className="-mr-1.5 -mt-1 h-9 w-9 grid place-items-center rounded-[6px] text-ink-2 hover:bg-paper-2 hover:text-ink transition-colors">
                <IconClose width={18} height={18} />
              </button>
            </header>
            <ul className="overflow-y-auto overscroll-contain divide-y divide-line">
              {sel.items.map(({ h, free }) => (
                <li key={h.work_id}>
                  <Link href={href(h)} className="book group flex gap-3.5 px-4 py-3 hover:bg-paper-2 transition-colors">
                    <span className="book-face flex-none">
                      <Cover data={{ title: h.title, authors: h.authors, photoKey: h.cover?.photo_key, photoW: h.cover?.photo_w, photoH: h.cover?.photo_h, coverKey: h.cover?.cover_key, seed: h.work_id }} width={44} height={66} uniform />
                    </span>
                    <span className="min-w-0 flex flex-col">
                      <span className="font-serif text-[16.5px] leading-[1.2] line-clamp-2 group-hover:text-accent-hover transition-colors">{h.title}</span>
                      {h.authors.length > 0 && <span className="text-[12.5px] text-muted truncate mt-0.5">{h.authors.join(", ")}</span>}
                      <span className="mt-auto pt-1.5 flex flex-wrap items-center gap-x-2.5 text-[12.5px]">
                        <span className={cx("inline-flex items-center gap-1.5 font-medium", free ? "text-ok" : "text-ink-2")}>
                          <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", free ? "bg-ok" : "bg-lent")} />
                          {free ? "Jetzt frei" : "Gerade vergeben"}
                        </span>
                        {h.offers.length > 0 && <span className="text-muted">{h.offers.map((o) => offerLabel[o]).join(" · ")}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="mt-3 text-[13px] text-muted max-w-2xl">
        Jeder Punkt fasst die Regale in einem Gebiet von rund einem Kilometer zusammen. Genaue Adressen siehst du nie; den Treffpunkt vereinbart ihr nach der Zusage.
      </p>
    </div>
  );
}
