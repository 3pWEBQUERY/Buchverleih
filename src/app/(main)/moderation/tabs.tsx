import Link from "next/link";
import { cx } from "@/components/ui";

export const TABS = [
  { id: "warteschlange", label: "Warteschlange" },
  { id: "kennzahlen", label: "Kennzahlen" },
  { id: "schalter", label: "Schalter" },
  { id: "konten", label: "Konten" },
  { id: "protokoll", label: "Protokoll" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

/** Reiter als Pillen-Links (?ansicht=…): teilbar, Zurück-Taste funktioniert. */
export function ModTabs({ active, counts = {} }: { active: Tab; counts?: Partial<Record<Tab, number>> }) {
  return (
    <nav aria-label="Bereiche der Moderation" className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 bg-paper/95 backdrop-blur-sm border-b border-line">
      <ul className="flex gap-6 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => {
          const on = t.id === active;
          const n = counts[t.id];
          return (
            <li key={t.id}>
              <Link href={t.id === "warteschlange" ? "/moderation" : `/moderation?ansicht=${t.id}`} aria-current={on ? "page" : undefined}
                className={cx("relative inline-flex items-center gap-2 h-12 text-[14px] font-medium transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}>
                {t.label}
                {n !== undefined && n > 0 && <span className="h-5 min-w-5 px-1.5 rounded-[4px] grid place-items-center text-[11.5px] tnum bg-accent-soft text-accent-hover">{n}</span>}
                {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
