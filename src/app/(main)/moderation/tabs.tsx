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

/** Reiter als Links (?ansicht=…): teilbar, Zurück-Taste funktioniert. */
export function ModTabs({ active }: { active: Tab }) {
  return (
    <nav aria-label="Bereiche der Moderation" className="border-b border-line -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none]">
      <ul className="flex gap-6 md:gap-8 text-[15px] whitespace-nowrap">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id}>
              <Link href={t.id === "warteschlange" ? "/moderation" : `/moderation?ansicht=${t.id}`} aria-current={on ? "page" : undefined}
                className={cx("relative block py-3 transition-colors", on ? "text-ink font-medium" : "text-muted hover:text-ink")}>
                {t.label}
                {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-ink" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
