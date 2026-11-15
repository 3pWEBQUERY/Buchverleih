"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";
import { IconDots, IconSearch } from "./icons";
import { useLocale } from "./locale-provider";
import { SHELL } from "@/lib/i18n/messages/shell";
import { CommandPalette, PALETTE_EVENT, SHORTCUTS, ShortcutHelp, type Shortcut } from "./command-palette";

export function NavLink({ href, icon, children, exact, tab }: { href: string; icon: ReactNode; children: ReactNode; exact?: boolean; tab?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  // Die Fläche des aktiven Eintrags zeichnet die gleitende Marke der NavRail (globals.css: .nav-marker)
  if (tab) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={cx("nav-tab relative z-[1] h-full flex flex-col items-center justify-center gap-1 transition-colors", active ? "text-ink" : "text-muted")}>
        <span data-nav-target className="nav-tab-icon grid place-items-center h-8 w-12 rounded-sm">{icon}</span>
        <span className={cx("leading-none", active && "font-semibold")}>{children}</span>
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("nav-side relative z-[1] flex items-center gap-3 px-3 h-10 rounded-sm transition-colors", active ? "text-ink font-medium" : "text-ink-2 hover:text-ink hover:bg-paper-3")}>
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

/**
 * Tastaturkürzel, Befehlspalette (⌘K / Ctrl+K) und Kürzel-Übersicht («?»).
 * Welche Tasten etwas tun, steht allein in SHORTCUTS (command-palette.tsx) – dieselbe Liste zeigt die Übersicht.
 */
export function Shortcuts() {
  const router = useRouter();
  const [view, setView] = useState<{ open: "palette" | "help" | null; seq: number }>({ open: null, seq: 0 });
  const close = useCallback(() => setView((v) => (v.open ? { ...v, open: null } : v)), []);
  const help = useCallback(() => setView((v) => ({ ...v, open: "help" })), []);

  useEffect(() => {
    let typed: string[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const palette = () => setView((v) => (v.open === "palette" ? { ...v, open: null } : { open: "palette", seq: v.seq + 1 }));
    const fire = (s: Shortcut) => {
      if (s.href) router.push(s.href);
      else if (s.command === "palette") palette();
      else if (s.command === "help") setView((v) => ({ ...v, open: "help" }));
      else {
        const input = document.querySelector<HTMLInputElement>("[data-search-input]");
        // Vorhandenen Suchtext markieren: die nächste Eingabe ersetzt ihn, statt davor zu landen
        if (input) { input.focus(); input.select(); }
        else router.push("/suche?fokus=1");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Ein fremder Dialog (Scanner, Vollbild) hat Vorrang: dahinter löst nichts aus
      if (document.querySelector("dialog[open]:not([data-shortcuts])")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        // ⌘/Ctrl-Kürzel gelten überall, auch in Eingabefeldern
        const s = !e.altKey && !e.shiftKey && SHORTCUTS.find((x) => x.keys[0] === "mod" && x.keys[1] === e.key.toLowerCase());
        if (s) { e.preventDefault(); fire(s); }
        return;
      }
      const t = e.target as HTMLElement;
      if (e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || document.querySelector("dialog[open]")) return;
      // Tastenfolgen («g» dann «s»): nach der ersten Taste bleiben 900 ms für die zweite
      const seq = [...typed, e.key];
      const fits = SHORTCUTS.filter((x) => x.keys[0] !== "mod" && seq.every((k, i) => x.keys[i] === k));
      clearTimeout(timer);
      typed = [];
      const exact = fits.find((x) => x.keys.length === seq.length);
      if (exact) { e.preventDefault(); fire(exact); }
      else if (fits.length) { typed = seq; timer = setTimeout(() => (typed = []), 900); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, palette);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, palette);
    };
  }, [router]);

  return (
    <>
      <CommandPalette open={view.open === "palette"} seq={view.seq} onClose={close} onHelp={help} />
      <ShortcutHelp open={view.open === "help"} onClose={close} />
    </>
  );
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

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
  const onKey = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
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
        <PaletteButton className="w-full flex items-center h-11 px-4 text-body text-left hover:bg-paper-2 transition-colors border-b border-line mb-1.5" />
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

/** Sichtbarer Zugang zur Befehlspalette (⌘K / Ctrl+K) – auch ohne Tastatur, z. B. im Mehr-Menü auf dem Telefon */
export function PaletteButton({ className, children }: { className?: string; children?: ReactNode }) {
  const l = useLocale();
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))}>
      {children ?? SHELL[l].palette.label}
    </button>
  );
}
