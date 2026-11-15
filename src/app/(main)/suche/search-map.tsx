"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as GlMap, Marker, StyleSpecification } from "maplibre-gl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { IconClose, IconPlus } from "@/components/icons";
import { cx } from "@/components/ui";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { SEARCH } from "@/lib/i18n/messages/search";
import type { WorkHit } from "@/lib/search";
import { STYLE_URL, circlePolygon, fallbackStyle, leihregalStyle } from "./map-style";

export type Center = { lat: number; lng: number };

type Spot = { key: string; lat: number; lng: number; free: number; items: { h: WorkHit; free: number }[] };

type Theme = "light" | "dark";
/** Gewählte Darstellung (data-theme), sonst die des Systems */
function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
function clusterSpots(m: GlMap, spots: Spot[], px = 44): Cluster[] {
  const groups: { x: number; y: number; cells: Spot[] }[] = [];
  const sorted = [...spots].sort((a, b) => b.items.length - a.items.length);
  for (const s of sorted) {
    const p = m.project([s.lng, s.lat]);
    const g = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < px);
    if (g) g.cells.push(s);
    else groups.push({ x: p.x, y: p.y, cells: [s] });
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

const pinSize = (n: number) => (n >= 20 ? 46 : n >= 8 ? 40 : n >= 3 ? 34 : 30);
const MAX_ZOOM = 16;

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
  const l = useLocale();
  const t = SEARCH[l].map;
  const tRef = useRef(t);
  tRef.current = t;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GlMap | null>(null);
  const gl = useRef<typeof import("maplibre-gl") | null>(null);
  const home = useRef<Marker | null>(null);
  /** Aktuelle Punkte mit ihren Gebieten, damit die Auswahl ohne Neuaufbau (und ohne Fokusverlust) aktualisiert werden kann */
  const markers = useRef<{ marker: Marker; el: HTMLButtonElement; cluster: Cluster }[]>([]);
  const panelHead = useRef<HTMLParagraphElement>(null);
  const lastPicked = useRef<string[] | null>(null);
  const spots = useMemo(() => spotsOf(hits), [hits]);
  const [zoom, setZoom] = useState(0);
  const [ready, setReady] = useState(0);
  const [built, setBuilt] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [osm, setOsm] = useState(false);
  const selCells = selected ? spots.filter((s) => selected.includes(s.key)) : [];
  const sel = selCells.length ? { items: mergeItems(selCells) } : null;
  const selFree = sel ? sel.items.filter((i) => i.free > 0).length : 0;

  // Karte einmal anlegen. MapLibre wird erst geladen, wenn jemand die Kartenansicht öffnet.
  useEffect(() => {
    if (!box.current || map.current) return;
    let dead = false;
    let m: GlMap | null = null;
    let base: StyleSpecification | null = null;
    let theme = currentTheme();
    const apply = () => {
      if (!m) return;
      m.setStyle(base ? leihregalStyle(base, theme) : fallbackStyle());
    };
    const watch = new MutationObserver(() => { const t = currentTheme(); if (t !== theme) { theme = t; apply(); } });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => { const t = currentTheme(); if (t !== theme) { theme = t; apply(); } };

    (async () => {
      const lib = await import("maplibre-gl");
      // Worker-Datei liegt unter public/vendor (scripts/vendor-maplibre.mjs); die Version verhindert alte Caches
      lib.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${lib.getVersion()}`);
      try {
        const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(String(res.status));
        base = (await res.json()) as StyleSpecification;
      } catch {
        // Vektorkarte nicht erreichbar: schlichtes Rasterbild von OpenStreetMap
        base = null;
        setOsm(true);
      }
      if (dead || !box.current) return;
      gl.current = lib;
      m = new lib.Map({
        container: box.current,
        style: base ? leihregalStyle(base, theme) : fallbackStyle(),
        center: [8.55, 47.42], zoom: 10, minZoom: 7, maxZoom: MAX_ZOOM,
        attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        fadeDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200,
      });
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      m.on("click", () => setSelected(null));
      m.on("zoomend", () => setZoom(m!.getZoom()));
      // Nach jedem Stilwechsel (hell/dunkel) liegen eigene Quellen und Ebenen nicht mehr auf der Karte
      m.on("style.load", () => setReady((n) => n + 1));
      map.current = m;
      watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      mq.addEventListener("change", onScheme);
    })();
    return () => {
      dead = true;
      watch.disconnect();
      mq.removeEventListener("change", onScheme);
      m?.remove();
      map.current = null;
    };
  }, []);

  // Umkreis und eigener Ort
  useEffect(() => {
    const m = map.current;
    const lib = gl.current;
    if (!m || !lib || !ready) return;
    home.current?.remove();
    home.current = null;
    const data = center
      ? { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [circlePolygon(center.lat, center.lng, radiusKm)] } }
      : { type: "FeatureCollection" as const, features: [] };
    const src = m.getSource("umkreis") as GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      m.addSource("umkreis", { type: "geojson", data });
      m.addLayer({ id: "umkreis-flaeche", type: "fill", source: "umkreis", paint: { "fill-color": accent, "fill-opacity": 0.04 } });
      m.addLayer({ id: "umkreis-linie", type: "line", source: "umkreis", paint: { "line-color": accent, "line-width": 1.5, "line-dasharray": [2, 3], "line-opacity": 0.8 } });
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!center) {
      if (spots.length) {
        const b = new lib.LngLatBounds();
        for (const s of spots) b.extend([s.lng, s.lat]);
        m.fitBounds(b, { padding: 56, maxZoom: 13, animate: !reduce });
      }
      return;
    }
    const el = document.createElement("span");
    el.className = "map-home";
    el.setAttribute("aria-hidden", "true");
    home.current = new lib.Marker({ element: el }).setLngLat([center.lng, center.lat]).addTo(m);
    const ring = circlePolygon(center.lat, center.lng, radiusKm, 8);
    const b = new lib.LngLatBounds();
    for (const c of ring) b.extend(c);
    m.fitBounds(b, { padding: 20, animate: !reduce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.lat, center?.lng, radiusKm, center ? null : spots]);

  // Auswahl verwerfen, wenn die Gebiete nach einer neuen Suche nicht mehr da sind
  useEffect(() => {
    setSelected((k) => (k && k.some((x) => spots.some((s) => s.key === x)) ? k.filter((x) => spots.some((s) => s.key === x)) : null));
  }, [spots]);

  // Punkte (bei jeder Zoomstufe neu zusammengefasst). Echte Knöpfe: Tastatur und Screenreader ohne Zutun.
  useEffect(() => {
    const m = map.current;
    const lib = gl.current;
    if (!m || !lib || !ready) return;
    // Hatte ein Punkt den Fokus, bekommt ihn nach dem Neuaufbau der Punkt mit denselben Gebieten
    const focused = markers.current.find((x) => x.el === document.activeElement)?.cluster.cells.map((c) => c.key);
    for (const x of markers.current) x.marker.remove();
    markers.current = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const c of clusterSpots(m, spots)) {
      const title = t.pin(c.titles, c.free);
      const size = pinSize(c.titles);
      const el = document.createElement("button");
      el.type = "button";
      el.className = `map-pin${c.free ? " is-free" : ""}`;
      el.style.width = el.style.height = `${size}px`;
      el.textContent = String(c.titles);
      el.title = title;
      el.setAttribute("aria-label", title);
      el.setAttribute("aria-expanded", "false");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        // Mehrere Gebiete unter einem Punkt: erst hineinzoomen, bis sie sich trennen
        if (c.cells.length > 1 && m.getZoom() < MAX_ZOOM - 1) {
          const b = new lib.LngLatBounds();
          for (const x of c.cells) b.extend([x.lng, x.lat]);
          const cam = m.cameraForBounds(b, { padding: 120, maxZoom: MAX_ZOOM });
          if (cam?.zoom !== undefined && cam.zoom > m.getZoom() + 0.2) return void m.easeTo({ center: b.getCenter(), zoom: cam.zoom, duration: reduce ? 0 : 400 });
        }
        const keys = c.cells.map((x) => x.key);
        lastPicked.current = keys;
        setSelected((k) => (k && k.join("|") === keys.join("|") ? null : keys));
      });
      const marker = new lib.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m);
      markers.current.push({ marker, el, cluster: c });
    }
    if (focused) markers.current.find((x) => x.cluster.cells.some((c) => focused.includes(c.key)))?.el.focus();
    setBuilt((n) => n + 1);
  }, [spots, zoom, t, ready]);

  // Auswahl: Zustand am bestehenden Knopf ändern (der Fokus bleibt)
  useEffect(() => {
    for (const { el, cluster } of markers.current) {
      const on = !!selected && cluster.cells.some((x) => selected.includes(x.key));
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-expanded", on ? "true" : "false");
    }
  }, [selected, built]);

  // Panel geöffnet: Fokus in die Überschrift
  const open = !!sel;
  useEffect(() => {
    if (open) panelHead.current?.focus();
  }, [open, selected]);

  /** Panel schliessen und den Fokus zurück auf den Punkt geben */
  const close = useCallback(() => {
    const keys = lastPicked.current;
    setSelected(null);
    if (!keys) return;
    requestAnimationFrame(() => {
      const back = markers.current.find((x) => x.cluster.cells.some((c) => keys.includes(c.key)));
      back?.el.focus();
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close]);

  const titles = new Set(spots.flatMap((s) => s.items.map((i) => i.h.work_id))).size;

  return (
    <div className="anim-rise">
      <div className="relative rounded-lg border border-line overflow-hidden bg-paper-2 isolate">
        <div ref={box} className="search-map h-[62vh] min-h-[420px] max-h-[680px] w-full" role="region" aria-label={t.region} />

        <div className="absolute left-3 bottom-3 z-[500] flex flex-col rounded-sm border border-line bg-paper overflow-hidden divide-y divide-line">
          <button type="button" onClick={() => map.current?.zoomIn()} aria-label={t.zoomIn} title={t.zoomIn} className="h-10 w-10 grid place-items-center text-ink hover:bg-paper-2 transition-colors"><IconPlus width={16} height={16} /></button>
          <button type="button" onClick={() => map.current?.zoomOut()} aria-label={t.zoomOut} title={t.zoomOut} className="h-10 w-10 grid place-items-center text-ink hover:bg-paper-2 transition-colors"><span aria-hidden className="block h-[1.5px] w-3.5 bg-current" /></button>
        </div>
        <p className="absolute right-2 bottom-2 z-[500] text-caption text-muted bg-paper/90 rounded-xs px-1.5 py-0.5">
          © {osm
            ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="text-ink-2 underline underline-offset-2">OpenStreetMap</a>
            : <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener" className="text-ink-2 underline underline-offset-2">swisstopo</a>}
        </p>

        <div className={cx("pointer-events-none absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 z-[500] transition-opacity", loading && "opacity-60")}>
          <span className="pointer-events-auto inline-flex items-center gap-2 h-8 px-3 rounded-sm bg-paper/95 border border-line text-meta font-medium text-ink-2">
            {spots.length === 0 ? t.noPlaces : t.summary(titles, spots.length)}
          </span>
          <span className="pointer-events-auto hidden sm:inline-flex items-center gap-3 h-8 px-3 rounded-sm bg-paper/95 border border-line text-meta text-muted">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /> {t.freeNow}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink-2 bg-paper" /> {t.taken}</span>
          </span>
        </div>

        {sel && (
          <section aria-label={t.panelAria}
            className="absolute z-[1100] inset-x-2 bottom-2 max-h-[58%] md:inset-x-auto md:right-3 md:top-3 md:bottom-8 md:max-h-none md:w-[360px] flex flex-col rounded-md border border-line bg-paper anim-rise">
            <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-line">
              <div className="min-w-0">
                <p ref={panelHead} tabIndex={-1} className="font-medium text-body focus:outline-none">{t.inArea(sel.items.length)}</p>
                <p className="text-meta text-muted mt-0.5">{selFree ? t.freeCount(selFree) : ""}{t.rounded}</p>
              </div>
              <button type="button" onClick={close} aria-label={t.close}
                className="-mr-1.5 -mt-1 h-9 w-9 grid place-items-center rounded-sm text-ink-2 hover:bg-paper-2 hover:text-ink transition-colors">
                <IconClose width={18} height={18} />
              </button>
            </header>
            <ul className="overflow-y-auto overscroll-contain divide-y divide-line">
              {sel.items.map(({ h, free }) => (
                <li key={h.work_id}>
                  <Link href={href(h)} className="book group flex gap-3.5 px-4 py-3 hover:bg-paper-2 transition-colors">
                    <span className="book-face flex-none">
                      <Cover l={l} data={{ title: h.title, authors: h.authors, photoKey: h.cover?.photo_key, photoColor: h.cover?.photo_color, photoW: h.cover?.photo_w, photoH: h.cover?.photo_h, coverKey: h.cover?.cover_key, coverColor: h.cover?.cover_color, seed: h.work_id }} width={44} height={66} uniform />
                    </span>
                    <span className="min-w-0 flex flex-col">
                      <span className="font-serif text-lead leading-title line-clamp-2 group-hover:text-accent-hover transition-colors">{h.title}</span>
                      {h.authors.length > 0 && <span className="text-meta text-muted truncate mt-0.5">{h.authors.join(", ")}</span>}
                      <span className="mt-auto pt-1.5 flex flex-wrap items-center gap-x-2.5 text-meta">
                        <span className={cx("inline-flex items-center gap-1.5 font-medium", free ? "text-ok" : "text-ink-2")}>
                          <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", free ? "bg-ok" : "bg-lent")} />
                          {SEARCH[l].avail.chipOne(free > 0)}
                        </span>
                        {h.offers.length > 0 && <span className="text-muted">{h.offers.map((o) => labels(l).offerLabel[o]).join(" · ")}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="mt-3 text-meta text-muted max-w-2xl">
        {t.note}
      </p>
    </div>
  );
}
