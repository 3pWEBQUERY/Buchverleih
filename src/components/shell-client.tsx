"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";
import { IconDots, IconSearch } from "./icons";
import { useLocale } from "./locale-provider";
import { SHELL } from "@/lib/i18n/messages/shell";

export function NavLink({ href, icon, children, exact, tab }: { href: string; icon: ReactNode; children: ReactNode; exact?: boolean; tab?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  if (tab) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={cx("flex flex-col items-center justify-center gap-1 transition-colors", active ? "text-ink" : "text-muted")}>
        <span className={cx("grid place-items-center h-8 w-12 rounded-sm transition-colors duration-fast", active && "bg-paper-3")}>{icon}</span>
        <span className={cx("leading-none", active && "font-semibold")}>{children}</span>
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("relative flex items-center gap-3 px-3 h-10 rounded-sm transition-colors duration-fast", active ? "bg-paper text-ink font-medium outline outline-1 outline-line-strong" : "text-ink-2 hover:text-ink hover:bg-paper-3")}>
      <span className={active ? "text-ink" : "text-muted"}>{icon}</span>
      <span className="flex-1 flex items-center justify-between gap-2">{children}</span>
    </Link>
  );
}

/** Suchfeld-Attrappe in der Seitenleiste: öffnet die Suche, Taste «/» */
export function SearchTrigger() {
  const l = useLocale();
  return (
    <Link href="/suche?fokus=1" className="h-11 px-4 rounded-sm border border-field bg-paper flex items-center gap-2.5 text-muted hover:border-ink transition-colors text-body-sm">
      <IconSearch width={18} height={18} />
      <span className="flex-1 truncate">{SHELL[l].searchPlaceholder}</span>
      <kbd className="font-sans text-caption border border-line-strong rounded-xs px-1.5 leading-5">/</kbd>
    </Link>
  );
}

/** Tastaturkürzel auf dem Desktop */
export function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    let g = false;
    let gTimer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-search-input]");
        if (input) input.focus();
        else router.push("/suche?fokus=1");
        return;
      }
      if (g) {
        g = false;
        const map: Record<string, string> = { s: "/", r: "/regal", v: "/vorgaenge", k: "/kreise", w: "/wunschliste", b: "/benachrichtigungen", e: "/einstellungen" };
        if (map[e.key]) router.push(map[e.key]);
        return;
      }
      if (e.key === "g") { g = true; clearTimeout(gTimer); gTimer = setTimeout(() => (g = false), 900); }
      if (e.key === "n") router.push("/regal/neu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

/**
 * Mobil: «Mehr»-Menü für Seiten, die nicht in der unteren Leiste stehen (Kreise, Wunschliste …).
 * Natives Popover: Esc und Tippen daneben schliessen von selbst, das Menü liegt in der obersten Ebene.
 * Pfeiltasten, Pos1 und Ende wandern durch die Einträge.
 */
export function MobileMore({ links, label = "Weitere Seiten" }: { links: { href: string; label: string }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const id = useId();
  const menu = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Nach einem Seitenwechsel schliessen
  useEffect(() => {
    const el = menu.current;
    if (el?.matches(":popover-open")) el.hidePopover();
  }, [path]);

  const items = () => [...(menu.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
  const onKey = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLAnchorElement);
    const go = (n: number) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i < 0 ? list.length - 1 : i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
  };

  return (
    <div className="relative">
      <button ref={trigger} type="button" popoverTarget={id} aria-expanded={open} aria-haspopup="true" aria-label={label}
        onKeyDown={(e) => {
          // Pfeil nach unten öffnet und springt in den ersten Eintrag (wie bei Menüs üblich)
          if (e.key === "ArrowDown" && !open) { e.preventDefault(); menu.current?.showPopover(); }
        }}
        className="press h-11 w-11 grid place-items-center rounded-sm hover:bg-paper-3 transition-colors">
        <IconDots />
      </button>
      <nav ref={menu} id={id} popover="auto" aria-label={label} onKeyDown={onKey}
        onToggle={(e) => {
          const now = (e as unknown as ToggleEvent).newState === "open";
          setOpen(now);
          if (now) items()[0]?.focus();
          else if (menu.current?.contains(document.activeElement)) trigger.current?.focus();
        }}
        className="more-menu fixed inset-auto top-[52px] right-2 m-0 w-56 rounded-md border border-field bg-paper text-ink py-1.5">
        {links.map((l) => {
          const active = path === l.href || path.startsWith(l.href + "/");
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
              className={cx("flex items-center h-11 px-4 text-body transition-colors", active ? "text-accent-hover font-medium bg-accent-soft/30" : "hover:bg-paper-2")}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
