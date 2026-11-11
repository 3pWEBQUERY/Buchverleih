"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

export type NavGroup = { title: string; danger?: boolean; items: { id: string; label: string }[] };

/**
 * Abschnittsnavigation der Einstellungen. Desktop: sticky Liste links.
 * Mobil: sticky Pillenleiste unter dem Kopf. Der sichtbare Abschnitt wird hervorgehoben.
 */
export function SettingsNav({ groups }: { groups: NavGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0]);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    function onScroll() {
      // Aktiv ist der letzte Abschnitt, dessen Oberkante das obere Drittel erreicht hat
      const line = window.innerHeight * 0.3;
      let cur = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1]?.id;
      if (cur) setActive(cur);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("hashchange", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktive Pille mobil in Sichtweite halten, ohne die Seite zu verschieben
  useEffect(() => {
    const wrap = bar.current;
    const pill = wrap?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!wrap || !pill || wrap.scrollWidth <= wrap.clientWidth) return;
    const left = pill.offsetLeft - wrap.clientWidth / 2 + pill.offsetWidth / 2;
    wrap.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  return (
    <>
      {/* Mobil und Tablet */}
      <div className="lg:hidden sticky top-14 md:top-0 z-20 -mx-4 md:-mx-12 bg-paper/95 backdrop-blur-md border-b border-line mb-8">
        <div ref={bar} className="flex gap-1.5 overflow-x-auto px-4 md:px-12 py-2.5" style={{ scrollbarWidth: "none" }}>
          {groups.flatMap((g) => g.items.map((i) => (
            <a key={i.id} href={`#${i.id}`} data-id={i.id} aria-current={active === i.id ? "location" : undefined}
              className={cx(
                "flex-none h-9 px-4 rounded-[6px] inline-flex items-center text-[13.5px] font-semibold transition-colors duration-200",
                active === i.id ? (g.danger ? "bg-late text-paper" : "bg-ink text-paper") : "text-ink-2 bg-paper-2 hover:bg-paper-3",
              )}>
              {i.label}
            </a>
          )))}
        </div>
      </div>

      {/* Desktop */}
      <nav aria-label="Abschnitte" className="hidden lg:block sticky top-10 self-start">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <p className={cx("eyebrow mb-2 px-3", g.danger && "!text-late")}>{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const on = active === i.id;
                return (
                  <li key={i.id}>
                    <a href={`#${i.id}`} aria-current={on ? "location" : undefined}
                      className={cx(
                        "relative flex items-center h-9 px-3 rounded-[6px] text-[14.5px] transition-colors duration-200",
                        on ? "bg-paper-2 text-ink font-semibold" : "text-muted hover:text-ink hover:bg-paper-2/60",
                      )}>
                      <span className={cx("absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-opacity duration-200", g.danger ? "bg-late" : "bg-ink", on ? "opacity-100" : "opacity-0")} />
                      {i.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
