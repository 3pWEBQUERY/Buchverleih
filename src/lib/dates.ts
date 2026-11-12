/**
 * Datumsformate. Fristen erscheinen immer als Datum und als Dauer (PRD 8.3, Punkt 2):
 * «Bis Sa, 12. Dez. (noch 9 Tage)».
 */
import { htmlLang, type Locale } from "@/lib/i18n/locale";

export const TZ = "Europe/Zurich";
export const LOCALE = "de-CH";

/** Formatierer pro Sprache, einmal angelegt */
const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(l: Locale, key: string, o: Intl.DateTimeFormatOptions) {
  const k = `${l}:${key}`;
  let f = fmts.get(k);
  if (!f) fmts.set(k, (f = new Intl.DateTimeFormat(htmlLang[l] ?? LOCALE, { ...o, timeZone: TZ })));
  return f;
}
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

export type DateLike = Date | string | number;
const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d));

/** «Sa, 12. Dez.» – Jahr nur, wenn es nicht das laufende ist. */
export function fmtDay(d: DateLike, l: Locale = "de") {
  const date = toDate(d);
  const sameYear = isoDay(date).slice(0, 4) === isoDay(new Date()).slice(0, 4);
  return fmt(l, sameYear ? "day" : "dayYear", sameYear
    ? { weekday: "short", day: "numeric", month: "short" }
    : { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function fmtTime(d: DateLike, l: Locale = "de") {
  return fmt(l, "time", { hour: "2-digit", minute: "2-digit" }).format(toDate(d));
}

export function fmtDayTime(d: DateLike, l: Locale = "de") {
  return `${fmtDay(d, l)}, ${fmtTime(d, l)}`;
}

/** «September 2026» */
export function fmtMonthYear(d: DateLike, l: Locale = "de") {
  return fmt(l, "monthYear", { month: "long", year: "numeric" }).format(toDate(d));
}

export function fmtMonth(d: DateLike, l: Locale = "de") {
  return fmt(l, "month", { month: "short" }).format(toDate(d));
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
const REL = {
  de: { today: "heute", tomorrow: "morgen", sinceYesterday: "seit gestern", left: (n: number) => `noch ${n} Tage`, since: (n: number) => `seit ${n} Tagen`, until: "Bis",
        expired: "abgelaufen", hLeft: (n: number) => `noch ${n} Std.`, mLeft: (n: number) => `noch ${n} Min.`,
        now: "gerade eben", mAgo: (n: number) => `vor ${n} Min.`, hAgo: (n: number) => `vor ${n} Std.`, dAgo: (n: number) => `vor ${n} ${n === 1 ? "Tag" : "Tagen"}` },
  fr: { today: "aujourd’hui", tomorrow: "demain", sinceYesterday: "depuis hier", left: (n: number) => `encore ${n} jours`, since: (n: number) => `depuis ${n} jours`, until: "Jusqu’au",
        expired: "expiré", hLeft: (n: number) => `encore ${n} h`, mLeft: (n: number) => `encore ${n} min`,
        now: "à l’instant", mAgo: (n: number) => `il y a ${n} min`, hAgo: (n: number) => `il y a ${n} h`, dAgo: (n: number) => `il y a ${n} jour${n === 1 ? "" : "s"}` },
  it: { today: "oggi", tomorrow: "domani", sinceYesterday: "da ieri", left: (n: number) => `ancora ${n} giorni`, since: (n: number) => `da ${n} giorni`, until: "Entro",
        expired: "scaduto", hLeft: (n: number) => `ancora ${n} h`, mLeft: (n: number) => `ancora ${n} min`,
        now: "proprio ora", mAgo: (n: number) => `${n} min fa`, hAgo: (n: number) => `${n} h fa`, dAgo: (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"} fa` },
} satisfies Record<Locale, unknown>;

export function relDays(day: string, from = todayCH(), l: Locale = "de") {
  const r = REL[l] ?? REL.de;
  const n = diffDays(from, day);
  if (n === 0) return r.today;
  if (n === 1) return r.tomorrow;
  if (n === -1) return r.sinceYesterday;
  if (n > 1) return r.left(n);
  return r.since(-n);
}

/** «Bis Sa, 12. Dez. (noch 9 Tage)» */
export function deadline(day: string, prefix?: string, l: Locale = "de") {
  return `${prefix ?? (REL[l] ?? REL.de).until} ${fmtDay(dayToDate(day), l)} (${relDays(day, todayCH(), l)})`;
}

/** Restzeit für Stundenfristen: «noch 41 Std.», «noch 25 Min.» */
export function relHours(until: DateLike, l: Locale = "de") {
  const r = REL[l] ?? REL.de;
  const ms = toDate(until).getTime() - Date.now();
  if (ms <= 0) return r.expired;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return r.left(Math.round(h / 24));
  if (h >= 1) return r.hLeft(h);
  return r.mLeft(Math.max(1, Math.round(ms / 60_000)));
}

export function ago(d: DateLike, l: Locale = "de") {
  const r = REL[l] ?? REL.de;
  const ms = Date.now() - toDate(d).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return r.now;
  if (m < 60) return r.mAgo(m);
  const h = Math.round(m / 60);
  if (h < 24) return r.hAgo(h);
  const days = Math.round(h / 24);
  if (days < 30) return r.dAgo(days);
  return fmtDay(d, l);
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
