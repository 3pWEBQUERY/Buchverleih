"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { Calendar, CalendarBar, FreeSlot } from "@/lib/loans/calendar";
import { addDays, dayToDate, diffDays, fmtDay, fmtRange } from "@/lib/dates";
import { statusLabel } from "@/lib/i18n/de-CH";
import { cx } from "./ui";
import { IconChat, IconPlus } from "./icons";

/**
 * Verleihkalender (PRD 4.8, 8.4): ein Balken pro Leihe auf einer Zeitachse, Puffer sichtbar,
 * freie Zeiträume antippbar, Symbol am Wechsel führt in den Übergabe-Chat.
 * Die Achse füllt die verfügbare Breite und scrollt nur, wenn es zu eng wird.
 */
const MONTH = new Intl.DateTimeFormat("de-CH", { month: "long", timeZone: "Europe/Zurich" });
const MONTH_SHORT = new Intl.DateTimeFormat("de-CH", { month: "short", timeZone: "Europe/Zurich" });
const HATCH = "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 6px)";

function barTone(b: CalendarBar) {
  if (b.kind === "block") return "text-muted border border-line-strong bg-paper";
  if (b.paused) return "bg-paper-3 text-muted border border-dashed border-line-strong";
  if (!b.status) return "bg-ink-2/55 text-paper";
  if (b.status === "active" || b.status === "return_reported") return "bg-lent text-white";
  if (b.status === "disputed") return "bg-late text-white";
  return "bg-wait text-white";
}

/** Wochentag 0 = Montag */
const weekday = (d: string) => (dayToDate(d).getUTCDay() + 6) % 7;

export function CalendarView({
  cal, onPick, compact, showLegend = true, showSummary, selection, fit, range, bare,
}: {
  cal: Calendar;
  onPick?: (slot: FreeSlot, start: string) => void;
  compact?: boolean;
  showLegend?: boolean;
  /** Kopfzeile mit «jetzt frei», Horizont und Vormerkungen (Standard: nicht bei compact) */
  showSummary?: boolean;
  selection?: { start: string; end: string; ok: boolean };
  /** Immer in die Breite einpassen, nie scrollen (Vorschauen) */
  fit?: boolean;
  /** Gemeinsamer Zeitraum, wenn mehrere Kalender untereinander stehen */
  range?: { start: string; end: string };
  /** Nur die Spur: ohne Monate, Datumsleiste und Heute-Schild (Achse steht separat) */
  bare?: boolean;
}) {
  const summary = !bare && (showSummary ?? !compact);
  const start = range?.start ?? addDays(cal.today, compact ? -3 : -7);
  const end = range?.end ?? addDays(cal.horizonEnd, compact ? 7 : 14);
  const days = diffDays(start, end);
  const minPx = compact ? 3 : 4.5;
  const pct = (d: string) => Math.max(0, Math.min(100, (diffDays(start, d) / days) * 100));
  const span = (a: string, b: string) => Math.max(0, pct(b) - pct(a));

  const { months, mondays } = useMemo(() => {
    const months: { label: string; left: number }[] = [];
    const mondays: { day: string; left: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d.endsWith("-01")) months.push({ label: MONTH.format(dayToDate(d)), left: (i / days) * 100 });
      if (weekday(d) === 0) mondays.push({ day: d, left: (i / days) * 100 });
    }
    if (!months.length || months[0].left > 8) months.unshift({ label: MONTH_SHORT.format(dayToDate(start)), left: 0 });
    return { months, mondays };
  }, [start, days]);

  // Auf schmalen Bildschirmen den gewählten Zeitraum ins Bild scrollen
  const scroller = useRef<HTMLDivElement>(null);
  const selStart = selection?.start;
  useEffect(() => {
    const el = scroller.current;
    if (!el || fit || !selStart || el.scrollWidth <= el.clientWidth) return;
    const left = (Math.max(0, Math.min(100, (diffDays(start, selStart) / days) * 100)) / 100) * el.scrollWidth - 48;
    el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [selStart, fit, start, days]);

  const free = cal.free.filter((f) => f.start < cal.horizonEnd);
  const freeNow = free.find((f) => f.start <= cal.today && cal.today < f.end);
  const nextFree = freeNow ?? free[0];
  const trackH = compact ? 32 : 44;
  const top = bare ? 4 : compact ? 34 : 40; // Platz für Monate und das Heute-Schild
  const axis = bare || compact ? 0 : 22; // Datumsleiste unter der Spur
  const selH = selection ? 22 : 0;
  const height = top + trackH + axis + selH + 4;

  return (
    <div>
      {summary && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 text-[13px]">
          <span className={cx("inline-flex items-center gap-2 h-7 px-2.5 rounded-[6px] font-medium", freeNow ? "bg-ok/10 text-ok" : "bg-paper-2 text-ink-2")}>
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", freeNow ? "bg-ok" : "bg-wait")} />
            {freeNow ? "Jetzt frei" : nextFree ? `Frei ab ${fmtDay(dayToDate(nextFree.start))}` : "Bis zum Horizont belegt"}
          </span>
          <span className="text-muted">Buchbar bis <span className="text-ink-2 tnum">{fmtDay(dayToDate(addDays(cal.horizonEnd, -1)))}</span></span>
          <span className="text-muted">Leihfrist <span className="text-ink-2 tnum">{cal.loanDays} Tage</span></span>
          {cal.bufferDays > 0 && <span className="text-muted">Puffer <span className="text-ink-2 tnum">{cal.bufferDays} {cal.bufferDays === 1 ? "Tag" : "Tage"}</span></span>}
        </div>
      )}

      <div ref={scroller} className={cx(!fit && "overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0")} style={{ scrollbarWidth: "thin" }}>
        <div className="relative select-none w-full" style={{ minWidth: fit ? undefined : days * minPx, height }}>
          {/* Monate */}
          {!bare && months.map((m) => (
            <span key={m.left} className={cx("absolute top-0 font-medium text-ink-2 whitespace-nowrap", compact ? "text-[11px]" : "text-[12px]")} style={{ left: `${m.left}%` }}>
              <span className="absolute top-[16px] w-px bg-line-strong" style={{ height: top - 16 }} />
              <span className="pl-1.5">{m.label}</span>
            </span>
          ))}

          {/* Spur mit Wochenraster */}
          <div className="absolute inset-x-0 rounded-[8px] bg-paper-2 overflow-hidden" style={{ top, height: trackH }}>
            {mondays.map((w) => <span key={w.day} aria-hidden className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${w.left}%` }} />)}
            {/* Ausserhalb des Horizonts */}
            <span className="absolute top-0 bottom-0 right-0 border-l border-line-strong" style={{ left: `${pct(cal.horizonEnd)}%`, backgroundImage: HATCH, opacity: 0.6 }}
              title="Noch nicht buchbar" />
            {!compact && span(cal.horizonEnd, end) > 9 && (
              <span className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] text-muted whitespace-nowrap" style={{ left: `${pct(cal.horizonEnd)}%` }}>nicht buchbar</span>
            )}
          </div>

          {/* Freie Zeiträume */}
          {free.map((f) => {
            const e = f.end < cal.horizonEnd ? f.end : cal.horizonEnd;
            const style = { top: top + 4, height: trackH - 8, left: `${pct(f.start)}%`, width: `${span(f.start, e)}%` };
            const label = `frei ab ${fmtDay(dayToDate(f.start))}`;
            return onPick ? (
              <button key={f.start} type="button" onClick={() => onPick(f, f.start)}
                className="absolute group rounded-[6px] border border-dashed border-ok/50 bg-ok/[0.06] hover:bg-ok/[0.14] hover:border-ok focus-visible:border-ok transition-colors flex items-center gap-1 px-1.5 text-[11.5px] font-medium text-ok overflow-hidden whitespace-nowrap"
                style={style} aria-label={`Frei ab ${fmtDay(dayToDate(f.start))}, ${f.days > 400 ? "unbegrenzt" : `${f.days} Tage`}. Zeitraum wählen`}>
                <IconPlus width={12} height={12} className="flex-none" /><span className="truncate">{label}</span>
              </button>
            ) : (
              <span key={f.start} aria-hidden className="absolute rounded-[6px] bg-ok/[0.07] flex items-center px-2 text-[11.5px] text-ok overflow-hidden whitespace-nowrap" style={style}>
                {!compact && <span className="truncate">{label}</span>}
              </span>
            );
          })}

          {/* Balken */}
          {cal.bars.map((b) => {
            const bEnd = b.end ?? end;
            const bufEnd = b.end ? addDays(b.end, b.bufferDays) : null;
            const label = b.kind === "block" ? b.note || "gesperrt" : b.name ?? (b.mine ? "deine Leihe" : "belegt");
            const range = fmtRange({ start: b.start, end: b.end });
            return (
              <div key={b.id}>
                <div className={cx("absolute rounded-[6px] px-2 flex items-center gap-2 overflow-hidden whitespace-nowrap", compact ? "text-[11px]" : "text-[12px]", barTone(b), b.mine && "ring-2 ring-accent ring-offset-1 ring-offset-paper")}
                  style={{ top: top + 2, height: trackH - 4, left: `${pct(b.start)}%`, width: `${Math.max(0.6, span(b.start, bEnd))}%`, ...(b.kind === "block" ? { backgroundImage: HATCH } : {}) }}
                  title={`${label}: ${range}${b.status ? ` · ${statusLabel[b.status]}` : ""}`}>
                  <span className="font-medium flex-none max-w-full truncate">{label}</span>
                  {!compact && b.end && <span className="opacity-75 min-w-0 truncate tnum hidden md:inline">{range}</span>}
                </div>
                {bufEnd && b.bufferDays > 0 && (
                  <span aria-hidden className="absolute rounded-r-[4px]" title={`Puffer ${b.bufferDays} Tage`}
                    style={{ top: top + 2, height: trackH - 4, left: `${pct(b.end!)}%`, width: `${span(b.end!, bufEnd)}%`, backgroundImage: HATCH }} />
                )}
                {b.handoverChatId && bufEnd && (
                  <Link href={`/uebergabe/${b.handoverChatId}`} className="absolute h-6 w-6 -translate-x-1/2 grid place-items-center rounded-full bg-paper border border-accent text-accent-hover hover:bg-accent hover:text-accent-ink transition-colors"
                    style={{ left: `${pct(bufEnd)}%`, top: top - 10 }} aria-label="Übergabe-Chat zum Wechsel">
                    <IconChat width={12} height={12} />
                  </Link>
                )}
              </div>
            );
          })}

          {/* Gewählter Zeitraum der Anfrage */}
          {selection && (
            <div aria-hidden className={cx("absolute rounded-[7px] border-2 pointer-events-none transition-[left,width] duration-200", selection.ok ? "border-accent bg-accent/[0.12]" : "border-late bg-late/10")}
              style={{ top: top - 2, height: trackH + 4, left: `${pct(selection.start)}%`, width: `${Math.max(0.8, span(selection.start, selection.end))}%` }}>
              <span className={cx("absolute left-0 whitespace-nowrap text-[11px] font-medium px-1.5 h-[18px] inline-flex items-center rounded-[4px]", selection.ok ? "bg-accent text-accent-ink" : "bg-late text-white")}
                style={{ top: trackH + 6 }}>
                {selection.ok ? "deine Anfrage" : "belegt"}
              </span>
            </div>
          )}

          {/* Datumsleiste: Montage */}
          {!compact && mondays.map((w) => (
            <span key={w.day} aria-hidden className="absolute text-[10.5px] text-muted tnum -translate-x-1/2" style={{ left: `${w.left}%`, top: top + trackH + 4 + selH }}>
              {Number(w.day.slice(8))}.
            </span>
          ))}

          {/* Heute */}
          <div className="absolute w-[2px] -translate-x-1/2 bg-accent pointer-events-none" style={{ left: `${pct(cal.today)}%`, top: top - 4, height: trackH + 8 }} aria-hidden>
            {!bare && (
              <span className={cx("absolute -top-[15px] text-[10px] font-semibold uppercase tracking-[0.06em] bg-accent text-accent-ink rounded-[3px] px-1 leading-[14px]",
                pct(cal.today) < 6 ? "-left-px" : pct(cal.today) > 94 ? "-right-px" : "left-1/2 -translate-x-1/2")}>Heute</span>
            )}
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] bg-lent" /> ausgeliehen</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] bg-wait" /> gebucht</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] border border-dashed border-ok/60 bg-ok/[0.08]" /> frei</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px]" style={{ backgroundImage: HATCH }} /> Puffer</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] border border-line-strong" style={{ backgroundImage: HATCH }} /> gesperrt</span>
          {onPick && <span className="text-ink-2">Freien Zeitraum antippen, um ihn zu wählen</span>}
        </div>
      )}

      {/* Textfassung für Screenreader und schnelles Lesen */}
      <ul className="sr-only">
        {cal.bars.map((b) => (
          <li key={b.id}>{b.kind === "block" ? "Gesperrt" : "Belegt"}: {fmtRange({ start: b.start, end: b.end })}</li>
        ))}
        {free.map((f) => <li key={f.start}>Frei ab {fmtDay(dayToDate(f.start))}</li>)}
      </ul>
    </div>
  );
}

/** Gemeinsame Zeitachse über mehreren Kalenderspuren: Monate, Montage, Heute */
export function CalendarAxis({ start, end, today }: { start: string; end: string; today: string }) {
  const days = diffDays(start, end);
  const pct = (d: string) => Math.max(0, Math.min(100, (diffDays(start, d) / days) * 100));
  const marks = useMemo(() => {
    const months: { label: string; left: number }[] = [];
    const mondays: { day: string; left: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d.endsWith("-01")) months.push({ label: MONTH.format(dayToDate(d)), left: (i / days) * 100 });
      if (weekday(d) === 0) mondays.push({ day: d, left: (i / days) * 100 });
    }
    if (!months.length || months[0].left > 10) months.unshift({ label: MONTH_SHORT.format(dayToDate(start)), left: 0 });
    return { months, mondays };
  }, [start, days]);
  return (
    <div className="relative h-[60px] select-none" aria-hidden>
      {marks.months.map((m) => (
        <span key={m.left} className="absolute top-0 text-[12px] font-medium text-ink-2 whitespace-nowrap" style={{ left: `${m.left}%` }}>
          <span className="absolute top-[16px] w-px h-[44px] bg-line-strong" /><span className="pl-1.5">{m.label}</span>
        </span>
      ))}
      {marks.mondays.map((w, i) => (
        <span key={w.day} className={cx("absolute top-[22px] text-[10.5px] text-muted tnum -translate-x-1/2", i % 2 === 1 && "hidden sm:inline")} style={{ left: `${w.left}%` }}>{Number(w.day.slice(8))}.</span>
      ))}
      <span className="absolute bottom-0 w-[2px] h-[14px] -translate-x-1/2 bg-accent" style={{ left: `${pct(today)}%` }} />
      <span className={cx("absolute bottom-[14px] text-[10px] font-semibold uppercase tracking-[0.06em] bg-accent text-accent-ink rounded-[3px] px-1 leading-[14px]", pct(today) < 6 ? "" : "-translate-x-1/2")} style={{ left: `${pct(today)}%` }}>Heute</span>
    </div>
  );
}
