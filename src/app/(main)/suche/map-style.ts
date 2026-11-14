import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Kartenbild der Suche: die «Leichte Basiskarte» von swisstopo als Vektorkarte, eingefärbt in den
 * Farben des Designsystems (Papier und Tinte, hell und dunkel). Die Karte ist Bühne, nicht Inhalt:
 * gedämpftes Gelände, helle Strassen, wenige Namen. Die Akzentfarbe bleibt den Punkten vorbehalten.
 * Frei nutzbar mit Quellenangabe (© swisstopo).
 */
export const STYLE_URL = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";

type Palette = {
  land: string; wood: string; green: string; water: string; waterLine: string; relief: string;
  road: string; roadCasing: string; highway: string; rail: string; building: string; boundary: string;
  label: string; labelMinor: string; labelWater: string; halo: string;
};

export const MAP_PALETTE: Record<"light" | "dark", Palette> = {
  light: {
    land: "#f4f0e8", wood: "#e3e4d3", green: "#e9e8d9", water: "#cbdae0", waterLine: "#b5c9d1", relief: "#8a8272",
    road: "#ffffff", roadCasing: "#d8d0c1", highway: "#fbf3df", rail: "#b3aa9a", building: "#e2dacb", boundary: "#c8c0b1",
    label: "#3b3934", labelMinor: "#68625a", labelWater: "#5d7f8c", halo: "#f4f0e8",
  },
  dark: {
    land: "#171715", wood: "#1c201a", green: "#1b1d18", water: "#18262c", waterLine: "#22363f", relief: "#000000",
    road: "#35332e", roadCasing: "#0f0f0e", highway: "#45413a", rail: "#57534a", building: "#24231f", boundary: "#46433c",
    label: "#d6d1c6", labelMinor: "#a39d91", labelWater: "#7fa3b1", halo: "#171715",
  },
};

/** Ebenen, die für «Bücher in der Nähe» nur Unruhe bringen: Höhenlinien, Gipfel, Sehenswürdigkeiten, Baustellen … */
const DROP = /^(scree|contour|hachure|pattern_|hillshade_yellow|spot_elevation|poi_|peaks_|area_name|aerodrome|road_number|construct|building_ln|building_casing|road_via_ferrata|hazard|park|landuse_parking|landcover_casing|landuse_outline|water_line_intermittent|boundary_disputed|aeroway_polygon_casing|place_country)/;

const motorway = (yes: string, no: string) => ["match", ["get", "class"], ["motorway", "trunk"], yes, no];

/**
 * Schriftgrösse einer Ebene skalieren. «zoom» darf nur zuoberst in interpolate/step stehen,
 * darum werden die Ausgabewerte der Stützstellen multipliziert, nicht der ganze Ausdruck.
 */
function scaleSize(v: unknown, f: number): unknown {
  if (typeof v === "number") return Math.round(v * f * 10) / 10;
  if (Array.isArray(v) && (v[0] === "interpolate" || v[0] === "step")) {
    const head = v[0] === "interpolate" ? 3 : 2;
    return v.map((x, i) => {
      if (i < head) return x;
      // interpolate: Stützstelle, Wert, Stützstelle, Wert …; step: Startwert, dann Stützstelle, Wert …
      const isValue = v[0] === "interpolate" ? (i - head) % 2 === 1 : (i - head) % 2 === 0;
      return isValue ? (typeof x === "number" ? Math.round(x * f * 10) / 10 : ["*", f, x]) : x;
    });
  }
  if (v && typeof v === "object" && Array.isArray((v as { stops?: unknown }).stops)) {
    const o = v as { stops: [number, number][] };
    return { ...o, stops: o.stops.map(([z, n]) => [z, Math.round(n * f * 10) / 10]) };
  }
  return v;
}

export function leihregalStyle(base: StyleSpecification, theme: "light" | "dark"): StyleSpecification {
  const p = MAP_PALETTE[theme];
  const layers: LayerSpecification[] = [];
  for (const src of base.layers) {
    if (DROP.test(src.id)) continue;
    // Kopie: die geladene Vorlage bleibt für den Wechsel hell/dunkel unverändert
    const l = JSON.parse(JSON.stringify(src)) as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
    const paint = (l.paint ??= {});
    const id = l.id;
    if (l.type === "background") paint["background-color"] = p.land;
    else if (id === "hillshade_grey") { paint["fill-color"] = p.relief; paint["fill-opacity"] = theme === "dark" ? 0.16 : 0.028; }
    else if (id === "landcover") { paint["fill-color"] = ["match", ["get", "class"], ["forest", "wood"], p.wood, p.green]; paint["fill-opacity"] = ["match", ["get", "class"], ["ice", "glacier"], 0, 1]; }
    else if (id === "landuse") { paint["fill-color"] = p.green; paint["fill-opacity"] = 0.7; }
    else if (id === "water") paint["fill-color"] = p.water;
    else if (id === "water_outline" || id === "water_line") paint["line-color"] = id === "water_line" ? p.water : p.waterLine;
    else if (id === "boundary") { paint["line-color"] = p.boundary; paint["line-opacity"] = 0.6; delete paint["line-blur"]; }
    else if (id === "aeroway_polygon_fill") paint["fill-color"] = p.building;
    else if (id === "building") paint["fill-color"] = p.building;
    else if (/public_transport/.test(id)) { paint["line-color"] = p.rail; }
    else if (/pedestrian|path_footway/.test(id)) { paint["line-color"] = p.roadCasing; }
    else if (/casing$/.test(id) || id === "tunnel_road") paint["line-color"] = motorway(p.roadCasing, p.roadCasing);
    else if (/fill$/.test(id) && l.type === "line") paint["line-color"] = motorway(p.highway, p.road);
    else if (l.type === "symbol") {
      const layout = (l.layout ??= {});
      const water = /water/.test(id);
      const minor = id === "place_other" || id === "transportation_label";
      paint["text-color"] = water ? p.labelWater : minor ? p.labelMinor : p.label;
      paint["text-halo-color"] = p.halo;
      paint["text-halo-width"] = 1.4;
      delete paint["text-halo-blur"];
      // Ortsnamen ruhiger: kleiner als in der Vorlage, ohne Punkt-Symbol
      if (id.startsWith("place_")) {
        if (layout["text-size"] !== undefined) layout["text-size"] = scaleSize(layout["text-size"], 0.74) as number;
        delete layout["icon-image"];
        layout["text-letter-spacing"] = 0.01;
        // Ortsnamen in normaler Schreibweise statt Versalien
        layout["text-transform"] = "none";
      }
    } else if (l.type === "line") paint["line-color"] = p.roadCasing;
    else if (l.type === "fill") paint["fill-color"] = p.green;
    layers.push(l);
  }
  return { ...base, layers };
}

/** Rückfall, wenn die Vektorkarte nicht lädt: OpenStreetMap als Rasterbild */
export function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19 } },
    layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7, "raster-contrast": -0.1 } }],
  };
}

/** Kreis um einen Punkt als Vieleck (für den Suchumkreis) */
export function circlePolygon(lat: number, lng: number, km: number, steps = 96): [number, number][] {
  const out: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}
