/**
 * Standort (PRD 4.3, 12): Speicherung auf rund 100 m gerundet, Anzeige zusätzlich
 * zufällig innerhalb von rund 150 m verschoben. Ein Regal erscheint als Fläche von ~300 m.
 */
export function round100m(lat: number, lng: number) {
  // 0.001° Breite ≈ 111 m; Länge in der Schweiz ≈ 75 m pro 0.001°
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 750) / 750 };
}

export function fuzz(lat: number, lng: number, meters = 150) {
  const r = meters * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  const dLat = (r * Math.cos(t)) / 111_320;
  const dLng = (r * Math.sin(t)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** «ca. 900 m», «1,4 km», «12 km» */
export function fmtDistance(m: number | null | undefined) {
  if (m == null || Number.isNaN(m)) return null;
  if (m < 1000) return `ca. ${Math.max(100, Math.round(m / 100) * 100)} m`;
  if (m < 9_950) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 1000)} km`;
}

/** Initialposition des Wohnorts aus der Postleitzahl, etwas gestreut, damit nicht alle auf einem Punkt liegen. */
export function homeFromPlz(lat: number, lng: number) {
  const spread = fuzz(lat, lng, 600);
  const home = round100m(spread.lat, spread.lng);
  const display = fuzz(home.lat, home.lng, 150);
  return { home, display };
}
