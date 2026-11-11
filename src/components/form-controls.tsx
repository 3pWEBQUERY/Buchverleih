"use client";
import type { ReactNode } from "react";
import { cx } from "./ui";
import { IconCheck, IconPlus } from "./icons";

/**
 * Gemeinsame Bedienelemente für Formularseiten (Buch bearbeiten, Exemplar anfragen):
 * Auswahlkarten mit Erklärung und Plus/Minus-Regler. Gewählt in der Markenfarbe, nie Schwarz.
 */
/** Auswahlkarte: gewählt in der Markenfarbe, nie Schwarz */
export function OptionCard({ on, title, desc, icon, multi, compact, onClick }: { on: boolean; title: string; desc?: string; icon?: ReactNode; multi?: boolean; compact?: boolean; onClick: () => void }) {
  return (
    <button type="button" role={multi ? undefined : "radio"} aria-checked={multi ? undefined : on} aria-pressed={multi ? on : undefined} onClick={onClick}
      className={cx("group relative text-left rounded-[10px] border transition-[border-color,background-color] duration-150",
        compact ? "px-4 py-3.5" : "px-4 py-3.5 sm:py-4",
        on ? "border-accent bg-accent-soft/35" : "border-line hover:border-ink-2 bg-paper")}>
      <span className={cx("absolute top-3.5 right-3.5 h-5 w-5 grid place-items-center border transition-colors",
        multi ? "rounded-[4px]" : "rounded-full",
        on ? "bg-accent border-accent text-accent-ink" : "border-line-strong group-hover:border-ink-2")}>
        {on && (multi ? <IconCheck width={13} height={13} strokeWidth={2.4} /> : <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" />)}
      </span>
      {icon && <span className={cx("hidden sm:block mb-3 transition-colors", on ? "text-accent-hover" : "text-muted")}>{icon}</span>}
      <span className="block font-medium text-[15px] pr-7">{title}</span>
      {desc && <span className="block text-[13px] text-muted mt-1 leading-snug pr-2">{desc}</span>}
    </button>
  );
}


/** Zahl mit Minus/Plus statt langer Segmentleiste */
export function Stepper({ value, min, max, format, onChange, label, full }: { value: number; min: number; max: number; format: (n: number) => string; onChange: (n: number) => void; label: string; full?: boolean }) {
  const btn = "h-10 w-10 grid place-items-center rounded-[6px] border border-line-strong text-ink-2 hover:border-accent hover:text-accent-hover transition-colors disabled:opacity-30 disabled:pointer-events-none";
  return (
    <div className={cx("items-center gap-2", full ? "flex w-full justify-between" : "inline-flex")} role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${label} verringern`}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path d="M6 12h12" /></svg>
      </button>
      <output className="min-w-[64px] flex-1 text-center text-[15px] font-medium tnum" aria-live="polite">{format(value)}</output>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${label} erhöhen`}>
        <IconPlus width={16} height={16} />
      </button>
    </div>
  );
}

