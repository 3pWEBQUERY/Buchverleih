"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { Calendar, CalendarBar, FreeSlot } from "@/lib/loans/calendar";
import { addDays, dayToDate, diffDays, fmtDay, fmtRange } from "@/lib/dates";
import { statusLabel } from "@/lib/i18n/de-CH";
import { cx } from "./ui";
import { IconChat } from "./icons";

/**
 * Verleihkalender (PRD 4.8, 8.4): ein Balken pro Leihe auf einer Zeitachse, Puffer sichtbar,
 * freie Zeiträume antippbar, Symbol am Wechsel führt in den Übergabe-Chat.
 */
const MONTH = new Intl.DateTimeFormat("de-CH", { month: "short", timeZone: "Europe/Zurich" });

function barTone(b: CalendarBar) {
  if (b.kind === "block") return "bg-paper-3 text-muted border border-line-strong";
  if (b.paused) return "bg-paper-3 text-muted border border-dashed border-line-strong";
  if (!b.status) return "bg-ink-2/70 text-paper";
  if (b.status === "active" || b.status === "return_reported") return "bg-lent text-paper";
  if (b.status === "disputed") return "bg-late text-paper";
  return "bg-wait text-paper";
}

export function CalendarView({
  cal, onPick, compact, showLegend = true, selection,
}: { cal: Calendar; onPick?: (slot: FreeSlot, start: string) => void; compact?: boolean; showLegend?: boolean; selection?: { start: string; end: string; ok: boolean } }) {
  const start = addDays(cal.today, -7);
  const end = addDays(cal.horizonEnd, 14);
  const days = diffDays(start, end);
  const pxDay = compact ? 7 : 11;
  const width = days * pxDay;
  const x = (d: string) => Math.max(0, Math.min(width, diffDays(start, d) * pxDay));

  const months = useMemo(() => {
    const out: { label: string; left: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d.endsWith("-01") || i === 0) out.push({ label: MONTH.format(dayToDate(d)), left: i * pxDay });
    }
    return out;
  }, [start, days, pxDay]);

  const free = cal.free.filter((f) => f.start < cal.horizonEnd);
  const trackH = compact ? 30 : 40;

  return (
    <div>
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: "thin" }}>
        <div className="relative select-none" style={{ width, height: trackH + (selection ? 50 : 34) }}>
          {/* Monate */}
          {months.map((m) => (
            <div key={m.left} className="absolute top-0 text-xs text-muted" style={{ left: m.left }}>
              <span className="pl-1">{m.label}</span>
              <span className="absolute top-5 h-[calc(var(--h))] w-px bg-line" style={{ ["--h" as string]: `${trackH + 8}px`, height: trackH + 8 }} />
            </div>
          ))}
          <div className="absolute inset-x-0 border-t border-line" style={{ top: 22 + trackH + 6 }} />

          {/* Horizont */}
          <div className="absolute bg-paper-2" style={{ top: 22, height: trackH, left: x(cal.horizonEnd), right: 0 }} title="Ausserhalb des Buchungshorizonts" />

          {/* Freie Zeiträume, antippbar */}
          {onPick &&
            free.map((f) => {
              const s = f.start;
              const e = f.end < cal.horizonEnd ? f.end : addDays(cal.horizonEnd, Math.min(cal.loanDays, 56));
              return (
                <button key={f.start} type="button" onClick={() => onPick(f, s)}
                  className="absolute group rounded-xs border border-ok/25 bg-ok/[0.06] hover:bg-ok/[0.12] hover:border-ok/60 focus-visible:border-ok transition-colors"
                  style={{ top: 22, height: trackH, left: x(s), width: Math.max(pxDay, x(e) - x(s)) }}
                  aria-label={`Frei ab ${fmtDay(dayToDate(s))}, ${f.days > 400 ? "unbegrenzt" : `${f.days} Tage`}. Anfragen`}>
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-ok whitespace-nowrap">frei ab {fmtDay(dayToDate(s))}</span>
                </button>
              );
            })}

          {/* Balken */}
          {cal.bars.map((b) => {
            const left = x(b.start);
            const right = b.end ? x(b.end) : width;
            const buf = b.end ? Math.min(width, x(addDays(b.end, b.bufferDays))) - right : 0;
            const label = b.kind === "block" ? b.note || "gesperrt" : b.name ?? (b.mine ? "deine Leihe" : "belegt");
            return (
              <div key={b.id} className="absolute flex" style={{ top: 22, height: trackH, left }}>
                <div className={cx("h-full rounded-xs px-1.5 flex items-center text-xs overflow-hidden whitespace-nowrap", barTone(b), b.mine && "outline-2 outline-ink outline-offset-1")}
                  style={{ width: Math.max(4, right - left) }} title={`${label}: ${fmtRange({ start: b.start, end: b.end })}${b.status ? ` · ${statusLabel[b.status]}` : ""}`}>
                  {right - left > 46 && label}
                </div>
                {buf > 0 && (
                  <div className="h-full" style={{ width: buf, backgroundImage: "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 5px)" }} title={`Puffer ${b.bufferDays} Tage`} />
                )}
                {b.handoverChatId && (
                  <Link href={`/uebergabe/${b.handoverChatId}`} className="absolute -right-3 -top-3 h-6 w-6 grid place-items-center rounded-full bg-paper border border-ink" style={{ left: right - left + buf - 12 }} aria-label="Übergabe-Chat zum Wechsel">
                    <IconChat width={13} height={13} />
                  </Link>
                )}
              </div>
            );
          })}

          {/* Gewählter Zeitraum der Anfrage */}
          {selection && (
            <div aria-hidden className={cx("absolute rounded-xs border-2 pointer-events-none transition-[left,width] duration-200", selection.ok ? "border-ink bg-ink/10" : "border-late bg-late/10")}
              style={{ top: 20, height: trackH + 4, left: x(selection.start), width: Math.max(pxDay, x(selection.end) - x(selection.start)) }}>
              <span className="absolute -bottom-5 left-0 text-[11px] font-medium whitespace-nowrap">deine Anfrage</span>
            </div>
          )}

          {/* Heute */}
          <div className="absolute w-px bg-ink" style={{ left: x(cal.today), top: 16, height: trackH + 12 }} aria-hidden>
            <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider bg-paper px-1">heute</span>
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-lent" /> ausgeliehen</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-wait" /> gebucht</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 5px)" }} /> Puffer</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-paper-3 border border-line-strong" /> gesperrt</span>
          {onPick && <span>Freie Zeiträume antippen, um anzufragen</span>}
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
