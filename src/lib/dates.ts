/**
 * Datumsformate. Fristen erscheinen immer als Datum und als Dauer (PRD 8.3, Punkt 2):
 * «Bis Sa, 12. Dez. (noch 9 Tage)».
 */
export const TZ = "Europe/Zurich";
export const LOCALE = "de-CH";

const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const dayYearFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: TZ });

export type DateLike = Date | string | number;
const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d));

/** «Sa, 12. Dez.» – Jahr nur, wenn es nicht das laufende ist. */
export function fmtDay(d: DateLike) {
  const date = toDate(d);
  const sameYear = isoDay(date).slice(0, 4) === isoDay(new Date()).slice(0, 4);
  return (sameYear ? dayFmt : dayYearFmt).format(date).replace(/,(?=\s\d)/, ",");
}

export function fmtTime(d: DateLike) {
  return timeFmt.format(toDate(d));
}

export function fmtDayTime(d: DateLike) {
  return `${fmtDay(d)}, ${fmtTime(d)}`;
}

export function fmtMonth(d: DateLike) {
  return monthFmt.format(toDate(d));
}

/** YYYY-MM-DD in Schweizer Zeit */
export function isoDay(d: DateLike) {
  return isoDayFmt.format(toDate(d));
}

/** Kalendertag (YYYY-MM-DD) als Date um 12 Uhr UTC – robust gegen Sommerzeit beim Rechnen. */
export function dayToDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

export function addDays(day: string, n: number) {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  return Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / 86_400_000);
}

export function todayCH() {
  return isoDay(new Date());
}

/** Letzter Leihtag aus einer Fälligkeit (due_at = Beginn des Folgetags). */
export function dueDay(dueAt: DateLike) {
  return isoDay(new Date(toDate(dueAt).getTime() - 1000));
}

/** «noch 9 Tage», «heute», «morgen», «seit 3 Tagen» */
export function relDays(day: string, from = todayCH()) {
  const n = diffDays(from, day);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "seit gestern";
  if (n > 1) return `noch ${n} Tage`;
  return `seit ${-n} Tagen`;
}

/** «Bis Sa, 12. Dez. (noch 9 Tage)» */
export function deadline(day: string, prefix = "Bis") {
  return `${prefix} ${fmtDay(dayToDate(day))} (${relDays(day)})`;
}

/** Restzeit für Stundenfristen: «noch 41 Std.», «noch 25 Min.» */
export function relHours(until: DateLike) {
  const ms = toDate(until).getTime() - Date.now();
  if (ms <= 0) return "abgelaufen";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `noch ${Math.round(h / 24)} Tage`;
  if (h >= 1) return `noch ${h} Std.`;
  return `noch ${Math.max(1, Math.round(ms / 60_000))} Min.`;
}

export function ago(d: DateLike) {
  const ms = Date.now() - toDate(d).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const days = Math.round(h / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return fmtDay(d);
}

/** Postgres-daterange «[2026-11-12,2026-12-10)» → { start, end } (end exklusiv) */
export function parseRange(r: string | null | undefined): { start: string; end: string | null } | null {
  if (!r) return null;
  const m = /^[[(]([^,]*),([^\])]*)[\])]$/.exec(r);
  if (!m) return null;
  return { start: m[1], end: m[2] || null };
}

export function fmtRange(r: { start: string; end: string | null }) {
  if (!r.end) return `ab ${fmtDay(dayToDate(r.start))}`;
  return `${fmtDay(dayToDate(r.start))} – ${fmtDay(dayToDate(addDays(r.end, -1)))}`;
}
