"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";

export function NavLink({ href, icon, children, exact, tab, kbd }: { href: string; icon: ReactNode; children: ReactNode; exact?: boolean; tab?: boolean; kbd?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  if (tab) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={cx("flex flex-col items-center justify-center gap-1 transition-colors", active ? "text-ink" : "text-muted")}>
        <span className={cx("transition-transform duration-200", active && "-translate-y-px")}>{icon}</span>
        <span className={cx(active && "font-semibold")}>{children}</span>
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("relative flex items-center gap-3 px-2 h-9 rounded-sm transition-colors", active ? "text-ink font-medium" : "text-ink-2 hover:text-ink hover:bg-paper-3")}>
      {active && <span aria-hidden className="absolute -left-5 top-2 bottom-2 w-[2px] bg-ink" />}
      <span className={active ? "text-ink" : "text-muted"}>{icon}</span>
      <span className="flex-1 flex items-center gap-2">{children}</span>
      {kbd && <kbd className="text-xs text-muted border border-line rounded-xs px-1.5 font-sans">{kbd}</kbd>}
    </Link>
  );
}

/** Ungelesene Benachrichtigungen; aktualisiert sich alle 60 Sekunden. */
export function UnreadDot({ initial, compact }: { initial: number; compact?: boolean }) {
  const [n, setN] = useState(initial);
  const path = usePathname();
  useEffect(() => setN(initial), [initial]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/v1/notifications");
        if (r.ok && alive) setN((await r.json()).unread ?? 0);
      } catch {}
    };
    const t = setInterval(tick, 60_000);
    if (path === "/benachrichtigungen") setN(0);
    return () => { alive = false; clearInterval(t); };
  }, [path]);
  if (!n) return null;
  if (compact) return <span className="block h-2 w-2 rounded-full bg-accent" aria-label={`${n} ungelesen`} />;
  return <span className="text-xs tnum text-accent font-semibold" aria-label={`${n} ungelesen`}>{n}</span>;
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
