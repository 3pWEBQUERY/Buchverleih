"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { cx } from "./ui";
import { IconBell, IconClose } from "./icons";

type Item = { id: string; type: string; title: string; body: string; href: string | null; loanId: string | null; createdAt: string };
type Ctx = { unread: number; bump: number };
const LiveCtx = createContext<Ctx>({ unread: 0, bump: 0 });
export const useUnread = () => useContext(LiveCtx);

/** Seiten, die sich bei einer neuen Benachrichtigung selbst neu laden, damit sie aktuell bleiben */
const REFRESH = ["/", "/benachrichtigungen", "/vorgaenge"];
const TOAST_MS = 8000;

/**
 * Benachrichtigungen live (Server-Sent Events): Zähler in Seitenleiste und Kopfzeile,
 * Hinweis unten rechts, sobald etwas eintrifft. Fällt die Verbindung aus,
 * fragt die Seite jede Minute nach.
 */
export function LiveNotifications({ initial, children }: { initial: number; children: ReactNode }) {
  const [unread, setUnread] = useState(initial);
  const [bump, setBump] = useState(0);
  const [toasts, setToasts] = useState<Item[]>([]);
  const path = usePathname();
  const router = useRouter();
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  const onNotifications = path === "/benachrichtigungen";

  // Verbindung aufbauen; der Browser verbindet sich bei Abbruch selbst neu
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    const fetchCount = async () => {
      try {
        const r = await fetch("/api/v1/notifications", { cache: "no-store" });
        if (r.ok && alive) setUnread((await r.json()).unread ?? 0);
      } catch {}
    };
    if (typeof EventSource !== "undefined") {
      es = new EventSource("/api/v1/notifications/stream");
      es.addEventListener("unread", (e) => {
        try { setUnread(JSON.parse((e as MessageEvent).data).unread ?? 0); } catch {}
      });
      es.addEventListener("notification", (e) => {
        let d: { unread: number; item: Item };
        try { d = JSON.parse((e as MessageEvent).data); } catch { return; }
        const here = pathRef.current;
        setBump((b) => b + 1);
        if (here === "/benachrichtigungen") {
          // Liste sofort neu zeigen, danach als gelesen markieren
          router.refresh();
          setTimeout(() => api("/notifications", { body: { all: true } }).catch(() => {}), 1500);
          return;
        }
        setUnread(d.unread);
        if (REFRESH.includes(here) || (d.item.loanId && here === `/vorgaenge/${d.item.loanId}`)) router.refresh();
        setToasts((t) => [d.item, ...t.filter((x) => x.id !== d.item.id)].slice(0, 3));
      });
    }
    // Rückfall: regelmässig nachfragen, solange keine Live-Verbindung steht
    poll = setInterval(() => { if (!es || es.readyState !== EventSource.OPEN) fetchCount(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      es?.close();
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  // Auf der Benachrichtigungsseite gilt alles als gelesen
  useEffect(() => {
    if (onNotifications) {
      setUnread(0);
      setToasts([]);
    }
  }, [onNotifications]);

  // Anzahl im Tab-Titel, z. B. «(2) Vorgänge · Leihregal»
  useEffect(() => {
    const set = () => {
      const base = document.title.replace(/^\(\d+\)\s/, "");
      const next = unread > 0 ? `(${unread}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    set();
    const t = setTimeout(set, 300); // nach dem Titelwechsel der neuen Seite
    return () => clearTimeout(t);
  }, [unread, path]);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <LiveCtx.Provider value={{ unread, bump }}>
      {children}
      {/* Ansage für Screenreader getrennt von den klickbaren Hinweisen */}
      <p className="sr-only" role="status" aria-live="polite">{toasts[0] ? `Neue Benachrichtigung: ${toasts[0].title}` : ""}</p>
      <div
        className="fixed z-50 inset-x-3 top-[64px] md:top-auto md:inset-x-auto md:bottom-6 md:right-6 flex flex-col gap-2 md:w-[380px] pointer-events-none">
        {toasts.map((t) => <Toast key={t.id} item={t} onClose={() => dismiss(t.id)} />)}
      </div>
    </LiveCtx.Provider>
  );
}

function Toast({ item, onClose }: { item: Item; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(TOAST_MS);
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const t = setTimeout(onClose, left.current);
    return () => { clearTimeout(t); left.current -= Date.now() - start; };
  }, [paused, onClose]);
  const href = item.href ?? "/benachrichtigungen";
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className="pointer-events-auto relative overflow-hidden rounded-[12px] border border-line-strong bg-paper anim-sheet">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 p-4 pr-2">
        <span aria-hidden className="h-9 w-9 rounded-full bg-accent-soft text-accent-hover grid place-items-center"><IconBell width={17} height={17} /></span>
        <Link href={href} onClick={onClose} className="min-w-0 group">
          <p className="text-[12px] text-muted flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> Neue Benachrichtigung · gerade eben
          </p>
          <p className="text-[14.5px] font-medium leading-snug mt-1 group-hover:underline underline-offset-2 decoration-1">{item.title}</p>
          {item.body && <p className="text-[13.5px] text-muted leading-snug mt-1 line-clamp-2">{item.body}</p>}
          <p className="text-[13px] font-medium text-accent-hover mt-2">{item.href ? "Ansehen" : "Alle Benachrichtigungen"} →</p>
        </Link>
        <button type="button" onClick={onClose} aria-label="Hinweis schliessen"
          className="h-9 w-9 -mt-1 rounded-[6px] text-muted hover:text-ink hover:bg-paper-3 grid place-items-center transition-colors">
          <IconClose width={16} height={16} />
        </button>
      </div>
      {/* verbleibende Zeit */}
      <span aria-hidden className="absolute left-0 bottom-0 h-[2px] bg-accent origin-left toast-timer"
        style={{ animationDuration: `${TOAST_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />
    </div>
  );
}

/** Glocke mit Punkt, sobald etwas Ungelesenes da ist; schwingt kurz bei neuer Benachrichtigung */
export function LiveBell({ size = 20 }: { size?: number }) {
  const { unread, bump } = useUnread();
  return (
    <span className="relative inline-grid place-items-center">
      <span key={bump} className={cx("inline-grid", bump > 0 && "bell-ring")}><IconBell width={size} height={size} /></span>
      {unread > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-paper-2" />}
    </span>
  );
}

/** Anzahl ungelesener Benachrichtigungen als Marke (Seitenleiste) oder Punkt (Kopfzeile mobil) */
export function UnreadBadge({ compact }: { compact?: boolean }) {
  const { unread, bump } = useUnread();
  if (!unread) return null;
  const label = `${unread} ungelesen`;
  if (compact) return <span key={bump} className="block h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-paper anim-pop"><span className="sr-only">, {label}</span></span>;
  return (
    <span key={bump} className="min-w-6 h-6 px-1.5 rounded-[6px] bg-accent text-accent-ink text-[12px] font-bold tnum grid place-items-center anim-pop">
      <span aria-hidden>{unread > 99 ? "99+" : unread}</span><span className="sr-only">{label}</span>
    </span>
  );
}
