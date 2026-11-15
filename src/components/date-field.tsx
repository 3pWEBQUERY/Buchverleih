"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "./ui";
import { Select } from "./select";
import { useLocale } from "./locale-provider";
import { htmlLang, type Locale } from "@/lib/i18n/locale";

/**
 * Datumsfeld mit eigener Oberfläche statt des Kalenders von Browser oder Betriebssystem.
 * Anzeige immer im Schweizer Format der gewählten Sprache (z. B. «Sa., 21. Nov. 2026»), unabhängig
 * von der Browser-Einstellung. Wert wie bei <input type="date">: «JJJJ-MM-TT» oder "".
 *
 * Bedienung nach dem ARIA-Muster «Date Picker Dialog»: Pfeiltasten wandern um Tage/Wochen,
 * Bild auf/ab um Monate (mit Umschalt um Jahre), Pos1/Ende zum Wochenanfang/-ende,
 * Enter/Leertaste wählt, Esc schliesst. Monat und Jahr lassen sich direkt wählen (Geburtsdatum).
 */

const TEXT: Record<Locale, { choose: string; prev: string; next: string; month: string; year: string; today: string; clear: string; time: string }> = {
  de: { choose: "Datum wählen", prev: "Vorheriger Monat", next: "Nächster Monat", month: "Monat", year: "Jahr", today: "Heute", clear: "Leeren", time: "Uhrzeit" },
  fr: { choose: "Choisir une date", prev: "Mois précédent", next: "Mois suivant", month: "Mois", year: "Année", today: "Aujourd’hui", clear: "Effacer", time: "Heure" },
  it: { choose: "Scegli una data", prev: "Mese precedente", next: "Mese successivo", month: "Mese", year: "Anno", today: "Oggi", clear: "Cancella", time: "Ora" },
  en: { choose: "Choose a date", prev: "Previous month", next: "Next month", month: "Month", year: "Year", today: "Today", clear: "Clear", time: "Time" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
const utc = (s: string) => {
  const p = parse(s)!;
  return new Date(Date.UTC(p.y, p.m, p.d));
};
const shift = (s: string, days: number) => {
  const d = utc(s);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shiftMonths = (s: string, n: number) => {
  const p = parse(s)!;
  const target = new Date(Date.UTC(p.y, p.m + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(p.d, last));
};
/** Heute in der Schweiz */
const todayCH = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
const clamp = (s: string, min?: string, max?: string) => (min && s < min ? min : max && s > max ? max : s);

export function formatDateValue(v: string, l: Locale, withWeekday = true) {
  if (!parse(v)) return "";
  return new Intl.DateTimeFormat(htmlLang[l], { timeZone: "UTC", ...(withWeekday ? { weekday: "short" } : {}), day: "numeric", month: "short", year: "numeric" }).format(utc(v));
}

export function DateField({
  value, onChange, min, max, required, id, className, placeholder, "aria-label": ariaLabel, "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const l = useLocale();
  const t = TEXT[l];
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const [open, setOpen] = useState(false);
  const today = todayCH();
  const [focus, setFocus] = useState(() => clamp(value || today, min, max));
  const fp = parse(focus)!;

  const show = () => {
    setFocus(clamp(value || today, min, max));
    setOpen(true);
  };
  const hide = useCallback((ret = true) => {
    setOpen(false);
    if (ret) btn.current?.focus();
  }, []);
  const pick = (d: string) => {
    if ((min && d < min) || (max && d > max)) return;
    onChange(d);
    hide();
  };

  // Popover platzieren (unten, sonst oben), Fokus in den Tag
  useLayoutEffect(() => {
    const el = pop.current;
    const b = btn.current;
    if (!el || !b) return;
    if (!open) { if (el.matches(":popover-open")) el.hidePopover(); return; }
    if (!el.matches(":popover-open")) el.showPopover();
    const place = () => {
      const r = b.getBoundingClientRect();
      const vh = window.innerHeight;
      const h = el.offsetHeight;
      const up = vh - r.bottom < h + 12 && r.top > vh - r.bottom;
      el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8))}px`;
      // Immer ganz sichtbar: reicht der Platz nirgends, rückt der Kalender so weit wie nötig nach oben
      el.style.top = up ? `${Math.max(8, r.top - h - 4)}px` : `${Math.max(8, Math.min(r.bottom + 4, vh - h - 8))}px`;
      el.dataset.side = up ? "top" : "bottom";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, focus]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const target = e.target as Node;
      // Listen der Monats-/Jahreswahl liegen als eigene Popover ausserhalb
      if ((target as Element).closest?.(".select-list")) return;
      if (!pop.current?.contains(target) && !btn.current?.contains(target)) hide(false);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open, hide]);

  const weeks = useMemo(() => {
    const first = new Date(Date.UTC(fp.y, fp.m, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Montag zuerst
    const start = shift(iso(fp.y, fp.m, 1), -lead);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => shift(start, w * 7 + d)));
  }, [fp.y, fp.m]);

  const fmtLong = new Intl.DateTimeFormat(htmlLang[l], { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(htmlLang[l], { timeZone: "UTC", weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 1.1.2024 = Montag
  }, [l]);
  const months = useMemo(() => {
    const f = new Intl.DateTimeFormat(htmlLang[l], { timeZone: "UTC", month: "long" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2024, i, 1))));
  }, [l]);
  const minY = min ? parse(min)!.y : Number(today.slice(0, 4)) - 100;
  const maxY = max ? parse(max)!.y : Number(today.slice(0, 4)) + 5;
  const years = useMemo(() => Array.from({ length: maxY - minY + 1 }, (_, i) => String(maxY - i)), [minY, maxY]);

  const move = (d: string) => setFocus(clamp(d, min, max));
  const onGridKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const map: Record<string, () => string> = {
      ArrowLeft: () => shift(focus, -1), ArrowRight: () => shift(focus, 1), ArrowUp: () => shift(focus, -7), ArrowDown: () => shift(focus, 7),
      PageUp: () => shiftMonths(focus, e.shiftKey ? -12 : -1), PageDown: () => shiftMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => shift(focus, -((utc(focus).getUTCDay() + 6) % 7)), End: () => shift(focus, 6 - ((utc(focus).getUTCDay() + 6) % 7)),
    };
    if (map[k]) { e.preventDefault(); move(map[k]()); return; }
    if (k === "Enter" || k === " ") { e.preventDefault(); pick(focus); return; }
    if (k === "Escape") { e.preventDefault(); hide(); }
  };

  const nav = "h-10 w-10 grid place-items-center rounded-sm text-ink-2 hover:bg-paper-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none";
  const prevOff = Boolean(min && iso(fp.y, fp.m, 1) <= min);
  const nextOff = Boolean(max && shiftMonths(iso(fp.y, fp.m, 1), 1) > max);

  return (
    <span className={cx("relative block", className)}>
      <button ref={btn} id={id} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ? `${ariaLabel}${value ? `: ${formatDateValue(value, l)}` : ""}` : undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? hide() : show())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); show(); } }}
        className={cx("w-full h-12 bg-paper border border-field rounded-sm pl-4 pr-11 text-body-lg text-left tnum hover:border-ink-2 focus:outline-none focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/10 transition-[border-color,box-shadow] relative", open && "border-ink")}>
        <span className={cx("block truncate", !value && "text-muted")}>{value ? formatDateValue(value, l) : placeholder ?? t.choose}</span>
        <svg aria-hidden viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-2">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
        </svg>
      </button>
      {/* Für Formulare mit required: verstecktes Feld, damit die Prüfung des Browsers greift */}
      {required && <input tabIndex={-1} aria-hidden className="sr-only" required value={value} onChange={() => {}} onFocus={() => btn.current?.focus()} />}
      <div ref={pop} popover="manual" role="dialog" aria-modal="false" aria-label={t.choose}
        className="select-list fixed inset-auto m-0 p-3 w-[min(328px,calc(100vw-16px))] rounded-md border border-line bg-paper text-ink">
        <div className="flex items-center gap-1.5 mb-2">
          <button type="button" className={nav} aria-label={t.prev} disabled={prevOff} onClick={() => move(shiftMonths(focus, -1))}>
            <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
          </button>
          <Select variant="pill" className="flex-1 [&>button]:w-full" aria-label={t.month} value={String(fp.m)}
            options={months.map((name, i) => ({ value: String(i), label: name }))}
            onChange={(v) => move(iso(fp.y, Number(v), Math.min(fp.d, new Date(Date.UTC(fp.y, Number(v) + 1, 0)).getUTCDate())))} />
          <Select variant="pill" aria-label={t.year} value={String(fp.y)}
            options={years.map((y) => ({ value: y, label: y }))}
            onChange={(v) => move(iso(Number(v), fp.m, Math.min(fp.d, new Date(Date.UTC(Number(v), fp.m + 1, 0)).getUTCDate())))} />
          <button type="button" className={nav} aria-label={t.next} disabled={nextOff} onClick={() => move(shiftMonths(focus, 1))}>
            <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
          </button>
        </div>
        <table ref={grid} role="grid" aria-label={`${months[fp.m]} ${fp.y}`} className="w-full border-collapse text-center" onKeyDown={onGridKey}>
          <thead>
            <tr>{weekdays.map((w) => <th key={w} scope="col" className="h-8 text-caption font-medium text-muted uppercase tracking-caps"><abbr title={w} className="no-underline">{w.slice(0, 2)}</abbr></th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w[0]}>
                {w.map((d) => {
                  const inMonth = parse(d)!.m === fp.m;
                  const off = Boolean((min && d < min) || (max && d > max));
                  const sel = d === value;
                  const isToday = d === today;
                  return (
                    <td key={d} className="p-0.5">
                      <button type="button" data-day={d} tabIndex={d === focus ? 0 : -1} disabled={off}
                        aria-label={fmtLong.format(utc(d))} aria-pressed={sel} aria-current={isToday ? "date" : undefined}
                        onClick={() => pick(d)}
                        className={cx("h-10 w-full rounded-sm text-body tnum transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          sel ? "bg-accent text-accent-ink font-semibold" : off ? "text-muted/50 line-through decoration-1" : "hover:bg-paper-2",
                          !inMonth && !sel && "text-muted", isToday && !sel && "ring-1 ring-inset ring-line-strong font-medium")}>
                        {Number(d.slice(8))}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-line text-body-sm">
          <button type="button" className="min-h-10 px-2 font-medium text-accent-hover hover:underline underline-offset-4 disabled:opacity-40"
            disabled={Boolean((min && today < min) || (max && today > max))} onClick={() => pick(today)}>{t.today}</button>
          {!required && value && (
            <button type="button" className="min-h-10 px-2 text-muted hover:text-ink hover:underline underline-offset-4" onClick={() => { onChange(""); hide(); }}>{t.clear}</button>
          )}
        </div>
      </div>
    </span>
  );
}

/**
 * Datum und Uhrzeit (Ersatz für <input type="datetime-local">). Wert «JJJJ-MM-TTTHH:MM» oder "".
 * Uhrzeit in Viertelstunden, als eigenes Auswahlfeld.
 */
export function DateTimeField({ value, onChange, min, required, className, "aria-label": ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  /** «JJJJ-MM-TTTHH:MM»: frühester Zeitpunkt */
  min?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const l = useLocale();
  const t = TEXT[l];
  const [date, time] = value ? value.split("T") : ["", ""];
  const minDate = min?.slice(0, 10);
  const times = useMemo(() => Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`), []);
  const opts = times
    .filter((x) => !(min && date && date === minDate && `${date}T${x}` < min))
    .map((x) => ({ value: x, label: x }));
  // Eine gespeicherte Zeit ausserhalb des Rasters (z. B. 18:20) bleibt wählbar
  if (time && !opts.some((o) => o.value === time)) opts.unshift({ value: time, label: time });
  const setDate = (d: string) => {
    if (!d) return onChange("");
    let tm = time || "18:00";
    if (min && `${d}T${tm}` < min) tm = opts.find((o) => `${d}T${o.value}` >= min)?.value ?? min.slice(11, 16);
    onChange(`${d}T${tm}`);
  };
  return (
    <span className={cx("grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2", className)}>
      <DateField value={date} onChange={setDate} min={minDate} required={required} aria-label={ariaLabel} />
      <Select value={time} placeholder="--:--" aria-label={t.time} options={opts} disabled={!date}
        onChange={(v) => onChange(`${date}T${v}`)} />
    </span>
  );
}
