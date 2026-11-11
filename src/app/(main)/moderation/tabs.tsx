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
    <nav aria-label="Bereiche der Moderation" className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none]">
      <ul className="inline-flex gap-1 p-1 bg-paper-2 rounded-full whitespace-nowrap">
        {TABS.map((t) => {
          const on = t.id === active;
          const n = counts[t.id];
          return (
            <li key={t.id}>
              <Link href={t.id === "warteschlange" ? "/moderation" : `/moderation?ansicht=${t.id}`} aria-current={on ? "page" : undefined}
                className={cx(
                  "h-10 px-4 md:px-5 rounded-[6px] inline-flex items-center gap-2 text-[14px] font-semibold transition-colors duration-200",
                  on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3",
                )}>
                {t.label}
                {n !== undefined && n > 0 && (
                  <span className={cx("h-5 min-w-5 px-1.5 rounded-[6px] grid place-items-center text-[11.5px] tnum", on ? "bg-paper text-ink" : "bg-ink text-paper")}>{n}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
