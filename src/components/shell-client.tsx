"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cx } from "./ui";
import { IconSearch } from "./icons";

export function NavLink({ href, icon, children, exact, tab }: { href: string; icon: ReactNode; children: ReactNode; exact?: boolean; tab?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  if (tab) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={cx("flex flex-col items-center justify-center gap-1 transition-colors", active ? "text-ink" : "text-muted")}>
        <span className={cx("grid place-items-center h-8 w-12 rounded-[6px] transition-colors duration-200", active && "bg-paper-3")}>{icon}</span>
        <span className={cx("leading-none", active && "font-semibold")}>{children}</span>
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("relative flex items-center gap-3 px-3 h-10 rounded-[6px] transition-colors duration-150", active ? "bg-paper text-ink font-medium outline outline-1 outline-line-strong" : "text-ink-2 hover:text-ink hover:bg-paper-3")}>
      <span className={active ? "text-ink" : "text-muted"}>{icon}</span>
      <span className="flex-1 flex items-center justify-between gap-2">{children}</span>
    </Link>
  );
}

/** Suchfeld-Attrappe in der Seitenleiste: öffnet die Suche, Taste «/» */
export function SearchTrigger() {
  return (
    <Link href="/suche?fokus=1" className="h-11 px-4 rounded-[6px] border border-line-strong bg-paper flex items-center gap-2.5 text-muted hover:border-ink transition-colors text-[15px]">
      <IconSearch width={18} height={18} />
      <span className="flex-1">Titel, Autorin, ISBN</span>
      <kbd className="font-sans text-[12px] border border-line-strong rounded-[4px] px-1.5 leading-5">/</kbd>
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
