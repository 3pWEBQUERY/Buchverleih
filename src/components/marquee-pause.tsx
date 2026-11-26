"use client";
import { useState } from "react";

/**
 * Pause für das Laufband der Startseite (WCAG 2.2.2): Bewegung lässt sich anhalten,
 * nicht nur über «Bewegung reduzieren» im System. Hält das umgebende `.marquee-wrap` an.
 */
export function MarqueePause({ pause, play }: { pause: string; play: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <button type="button" aria-pressed={paused}
      onClick={(e) => {
        const wrap = (e.currentTarget as HTMLElement).closest(".marquee-wrap");
        const next = !paused;
        setPaused(next);
        if (wrap) { if (next) wrap.setAttribute("data-paused", ""); else wrap.removeAttribute("data-paused"); }
      }}
      className="absolute right-3 top-3 z-10 h-9 px-3 rounded-sm bg-night/70 text-night-ink text-meta font-medium inline-flex items-center gap-2 backdrop-blur hover:bg-night/90 focus-visible:outline-2">
      <span aria-hidden className="inline-flex gap-[3px]">
        {paused
          ? <span className="block w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" />
          : <><span className="block w-[3px] h-[10px] bg-current" /><span className="block w-[3px] h-[10px] bg-current" /></>}
      </span>
      {paused ? play : pause}
    </button>
  );
}
