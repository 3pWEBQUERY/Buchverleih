"use client";
import { useEffect, useState } from "react";
import { cx } from "./ui";
import type { TocItem } from "./doc";

/** Mitlaufendes Inhaltsverzeichnis: hebt den Abschnitt hervor, der gerade gelesen wird. */
export function DocToc({ toc }: { toc: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = toc.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    function onScroll() {
      const line = window.innerHeight * 0.28;
      let cur: string | null = null;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1]?.id ?? cur;
      setActive(cur ?? els[0]?.id ?? null);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  const idx = Math.max(0, toc.findIndex(([id]) => id === active));
  const progress = toc.length > 1 ? (idx / (toc.length - 1)) * 100 : 100;

  return (
    <nav aria-label="Inhalt" className="sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Inhalt</p>
        <span className="text-[12px] text-muted tnum">{idx + 1} / {toc.length}</span>
      </div>
      <div className="relative">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-px bg-line" />
        <span aria-hidden className="absolute left-0 top-0 w-[2px] -translate-x-[0.5px] bg-accent transition-[height] duration-300 ease-[var(--ease-out-quart)]" style={{ height: `${Math.max(6, progress)}%` }} />
        <ol className="flex flex-col">
          {toc.map(([id, label]) => {
            const on = id === active;
            return (
              <li key={id}>
                <a href={`#${id}`} aria-current={on ? "location" : undefined}
                  className={cx(
                    "relative block py-[7px] pl-5 text-[14px] leading-snug transition-colors duration-200",
                    on ? "text-accent-hover font-medium" : "text-muted hover:text-ink",
                  )}>
                  <span aria-hidden className={cx("absolute left-[-3px] top-1/2 -translate-y-1/2 h-[7px] w-[7px] rounded-full transition-[background-color,transform] duration-200", on ? "bg-accent scale-100" : "bg-transparent scale-0")} />
                  {label}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
