"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { LOCALES, localeName, type Locale } from "@/lib/i18n/locale";
import { SHELL } from "@/lib/i18n/messages/shell";
import type { PaletteData } from "@/lib/palette";
import type { WorkHit } from "@/lib/search";
import { IconArrowRight, IconBell, IconBookmark, IconCalendar, IconCircles, IconClose, IconHome, IconLoans, IconScan, IconSearch, IconSettings, IconShelf, IconShield } from "./icons";
import { useLocale } from "./locale-provider";
import { useToast } from "./toast";
import { cx } from "./ui";

type M = (typeof SHELL)[Locale];

/* ------------------------------------------------------------------ Kürzel */

/**
 * Alle Tastaturkürzel der App – die einzige Quelle. `Shortcuts` (shell-client.tsx) liest daraus,
 * welche Tasten etwas tun; die Übersicht («?») und die Kürzel-Hinweise in der Palette zeigen
 * dieselben Einträge. Ein neues Kürzel entsteht hier und nirgends sonst.
 *
 * `keys` ist eine Folge («g» dann «s»). Beginnt sie mit «mod», ist ⌘ (Mac) bzw. Ctrl gemeint;
 * solche Kürzel gelten auch in Eingabefeldern, alle anderen nur ausserhalb.
 */
export type Shortcut = {
  id: string;
  keys: readonly string[];
  group: "general" | "go";
  label: (m: M) => string;
} & ({ href: string; command?: undefined } | { command: "palette" | "help" | "search"; href?: undefined });

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "palette", keys: ["mod", "k"], group: "general", label: (m) => m.palette.shortcuts.openPalette, command: "palette" },
  { id: "search", keys: ["/"], group: "general", label: (m) => m.palette.shortcuts.focusSearch, command: "search" },
  { id: "new", keys: ["n"], group: "general", label: (m) => m.addBook, href: "/regal/neu" },
  { id: "help", keys: ["?"], group: "general", label: (m) => m.palette.shortcuts.showHelp, command: "help" },
  { id: "start", keys: ["g", "s"], group: "go", label: (m) => m.nav.start, href: "/" },
  { id: "shelf", keys: ["g", "r"], group: "go", label: (m) => m.nav.shelf, href: "/regal" },
  { id: "loans", keys: ["g", "v"], group: "go", label: (m) => m.nav.loans, href: "/vorgaenge" },
  { id: "circles", keys: ["g", "k"], group: "go", label: (m) => m.nav.circles, href: "/kreise" },
  { id: "wishlist", keys: ["g", "w"], group: "go", label: (m) => m.nav.wishlist, href: "/wunschliste" },
  { id: "notifications", keys: ["g", "b"], group: "go", label: (m) => m.nav.notifications, href: "/benachrichtigungen" },
  { id: "settings", keys: ["g", "e"], group: "go", label: (m) => m.nav.settings, href: "/einstellungen" },
];

/** Von aussen öffnen (z. B. ein Knopf in der Kopfzeile): window.dispatchEvent(new Event(PALETTE_EVENT)) */
export const PALETTE_EVENT = "leihregal:palette";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const noop = () => () => {};
const useMac = () => useSyncExternalStore(noop, isMac, () => false);

const kbdCls = "font-sans text-caption text-muted border border-line-strong rounded-xs px-1.5 leading-5 whitespace-nowrap";

/** Tasten eines Kürzels, gesetzt wie das bestehende <kbd> in der Seitenleiste */
export function Keys({ keys, mac, then }: { keys: readonly string[]; mac: boolean; then?: string }) {
  const mod = keys[0] === "mod";
  const list = mod ? [mac ? "⌘" : "Ctrl", ...keys.slice(1).map((k) => k.toUpperCase())] : keys;
  return (
    <span className="inline-flex items-center gap-1 flex-none">
      {list.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && !mod && then && <span className="text-caption text-muted">{then}</span>}
          <kbd className={kbdCls}>{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ Dialog */

/** Natives <dialog>: showModal() bringt Fokusfalle, Esc, inerten Hintergrund und die Rückgabe des Fokus mit */
function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

function Dialog({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useDialog(open);
  const downOutside = useRef(false);
  return (
    <dialog ref={ref} data-shortcuts aria-label={label} onClose={onClose}
      // Tippen auf den Schleier schliesst – nur wenn der Druck auch dort begann (kein Schliessen beim Markieren)
      onPointerDown={(e) => { downOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOutside.current && e.target === e.currentTarget) onClose(); }}
      className="palette fixed inset-0 mx-auto mt-4 md:mt-[12vh] mb-auto p-0 w-[calc(100vw-32px)] max-w-[640px] max-h-none overflow-hidden rounded-lg border border-field bg-paper text-ink">
      {children}
    </dialog>
  );
}

/* --------------------------------------------------------- Kürzel-Übersicht */

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = SHELL[useLocale()];
  const s = m.palette.shortcuts;
  const mac = useMac();
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} label={s.title}>
      <div className="flex items-center justify-between gap-4 pl-5 pr-2 h-14 border-b border-line">
        <h2 id={titleId} className="text-body-lg font-title">{s.title}</h2>
        <button type="button" onClick={onClose} aria-label={s.close} className="press h-11 w-11 grid place-items-center rounded-sm text-muted hover:text-ink hover:bg-paper-2">
          <IconClose />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-140px)] md:max-h-[min(72dvh,640px)] overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
        {(["general", "go"] as const).map((g) => (
          <section key={g} aria-labelledby={`${titleId}-${g}`}>
            <h3 id={`${titleId}-${g}`} className="text-caption font-medium text-muted mt-4 mb-1">{s[g]}</h3>
            <dl>
              {SHORTCUTS.filter((x) => x.group === g).map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-4 min-h-11 py-1.5 border-b border-line last:border-b-0">
                  <dt className="text-body min-w-0">{x.label(m)}</dt>
                  <dd><Keys keys={x.keys} mac={mac} then={s.then} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="text-meta text-muted mt-4">{s.hint}</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Palette */

type GroupId = "recent" | "actions" | "loans" | "books" | "circles" | "pages" | "titles" | "search";
type Kind = "action" | "loan" | "book" | "circle" | "page" | "title" | "search";
type Item = {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  /** kurzer Zusatz rechts, z. B. «Du bist dran» */
  note?: string;
  /** Buchtitel stehen in Literata */
  serif?: boolean;
  icon: ReactNode;
  href?: string;
  run?: () => void;
  /** Palette bleibt offen (Erneut laden) */
  keep?: boolean;
  /** nicht unter «Zuletzt benutzt» merken */
  transient?: boolean;
  keys?: readonly string[];
  /** Sprache des Eintrags, wenn sie von der Oberfläche abweicht (Sprachnamen) */
  lang?: Locale;
  /** zusätzlicher Suchtext */
  more?: string;
};
type Group = { id: GroupId; label: string; items: Item[]; loading?: boolean; error?: string };

type Recent = { id: string; kind: Kind; label: string; sub?: string; href: string };
const RECENT_KEY = "lr_palette_recent";
const RECENT_MAX = 6;

function readRecents(): Recent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((r): r is Recent => r && typeof r.id === "string" && typeof r.label === "string" && typeof r.href === "string" && r.href.startsWith("/")).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
function remember(it: Item) {
  if (it.transient || it.keep) return;
  try {
    const next: Recent[] = [{ id: it.id, kind: it.kind, label: it.label, sub: it.sub, href: it.href ?? "/" }, ...readRecents().filter((r) => r.id !== it.id)];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_MAX)));
  } catch {
    /* Speicher gesperrt (privater Modus): dann eben ohne Verlauf */
  }
}

/** Vergleich ohne Gross-/Kleinschreibung und ohne Akzente (é = e, ü = u) */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const matcher = (q: string) => {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return (it: Item) => {
    const hay = fold(`${it.label} ${it.sub ?? ""} ${it.more ?? ""}`);
    return words.every((w) => hay.includes(w));
  };
};

const kindIcon: Record<Kind, ReactNode> = {
  action: <IconArrowRight width={18} height={18} />,
  loan: <IconLoans width={18} height={18} />,
  book: <IconShelf width={18} height={18} />,
  circle: <IconCircles width={18} height={18} />,
  page: <IconArrowRight width={18} height={18} />,
  title: <IconSearch width={18} height={18} />,
  search: <IconArrowRight width={18} height={18} />,
};
const pageIcon: Record<string, ReactNode> = {
  start: <IconHome width={18} height={18} />, shelf: <IconShelf width={18} height={18} />, loans: <IconLoans width={18} height={18} />,
  circles: <IconCircles width={18} height={18} />, wishlist: <IconBookmark width={18} height={18} />, notifications: <IconBell width={18} height={18} />,
  settings: <IconSettings width={18} height={18} />, searchPage: <IconSearch width={18} height={18} />, calendar: <IconCalendar width={18} height={18} />,
  moderation: <IconShield width={18} height={18} />,
};
/** Kleines Zeichen statt Icon (Sprachkürzel, «?»): gleiche Fläche wie die 18er-Icons */
const Glyph = ({ children }: { children: string }) => (
  <span aria-hidden className="grid place-items-center w-[18px] text-caption font-semibold uppercase leading-none">{children}</span>
);

type Me = { shelfPaused: boolean; role: string };
type Loaded<T> = { status: "idle" | "loading" | "ok" | "error"; value?: T };
const patchPaused = (shelfPaused: boolean) => api("/me", { method: "PATCH", body: { shelfPaused } });

const useOnline = () =>
  useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
    },
    () => navigator.onLine,
    () => true,
  );

/**
 * Befehlspalette (⌘K / Ctrl+K). `seq` zählt die Öffnungen: jede beginnt mit leerem Feld,
 * die geladenen Listen bleiben über Öffnungen hinweg erhalten und werden im Hintergrund erneuert.
 */
export function CommandPalette({ open, seq, onClose, onHelp }: { open: boolean; seq: number; onClose: () => void; onHelp: () => void }) {
  const m = SHELL[useLocale()];
  const [data, setData] = useState<Loaded<PaletteData>>({ status: "idle" });
  const [me, setMe] = useState<Me | null>(null);

  const online = useOnline();

  const fetchData = useCallback(() =>
    api<PaletteData>("/me/palette").then(
      (value) => setData({ status: "ok", value }),
      // Schon Geladenes bleibt stehen; nur ohne Daten wird der Fehler gezeigt
      () => setData((d) => (d.value ? { status: "ok", value: d.value } : { status: "error" })),
    ), []);
  const reload = useCallback(() => {
    setData((d) => ({ status: "loading", value: d.value }));
    void fetchData();
  }, [fetchData]);

  // Erst beim Öffnen laden, nicht mit jeder Seite; bis zur ersten Antwort gilt «lädt»
  useEffect(() => {
    if (!open || !online) return;
    void fetchData();
    api<{ user: { shelfPaused: boolean; role: string } | null }>("/me").then(
      (r) => { if (r.user) setMe({ shelfPaused: r.user.shelfPaused, role: r.user.role }); },
      () => { /* ohne Kontostand fehlt nur «Regal pausieren» */ },
    );
  }, [open, seq, online, fetchData]);

  return (
    <Dialog open={open} onClose={onClose} label={m.palette.label}>
      {seq > 0 && <Body key={seq} data={data} me={me} setMe={setMe} reload={reload} onClose={onClose} onHelp={onHelp} />}
    </Dialog>
  );
}

function Body({ data, me, setMe, reload, onClose, onHelp }: {
  data: Loaded<PaletteData>; me: Me | null; setMe: (m: Me) => void; reload: () => void; onClose: () => void; onHelp: () => void;
}) {
  const locale = useLocale();
  const m = SHELL[locale];
  const p = m.palette;
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const mac = useMac();
  const uid = useId();
  const listId = `${uid}-list`;
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recents] = useState(readRecents);
  const q = query.trim();

  /* Titel aus der Suche: verzögert, überholte Anfragen werden abgebrochen */
  const [titles, setTitles] = useState<{ q: string; status: "loading" | "ok" | "error"; hits: WorkHit[] }>({ q: "", status: "ok", hits: [] });
  const wantTitles = q.length >= 2 && online;
  useEffect(() => {
    if (!wantTitles) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setTitles((t) => ({ q, status: "loading", hits: t.hits }));
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { credentials: "same-origin", signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as { results: WorkHit[] };
        setTitles({ q, status: "ok", hits: d.results.slice(0, 6) });
      } catch {
        if (!ctrl.signal.aborted) setTitles({ q, status: "error", hits: [] });
      }
    }, 200);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, wantTitles]);
  const titlesPending = wantTitles && (titles.q !== q || titles.status === "loading");

  const setPaused = useCallback(async (next: boolean) => {
    const apply = async (to: boolean) => {
      await patchPaused(to);
      setMe({ shelfPaused: to, role: me?.role ?? "member" });
      router.refresh();
    };
    try {
      await apply(next);
      // Umkehrbar: sofort ausführen und «Rückgängig» anbieten statt nachzufragen
      toast.show({ text: next ? p.paused : p.resumed, undo: () => apply(!next).catch((e) => toast.error((e as Error).message)) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [me?.role, p.paused, p.resumed, router, setMe, toast]);

  const setLocale = useCallback(async (l: Locale) => {
    try {
      await api("/locale", { body: { locale: l } });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [router, toast]);

  const groups = useMemo<Group[]>(() => {
    const d = data.value;
    const status = labels(locale).statusLabel;

    const actions: Item[] = [
      { id: "act:new", kind: "action", label: m.addBook, icon: <IconScan width={18} height={18} />, href: "/regal/neu", keys: SHORTCUTS.find((s) => s.id === "new")?.keys },
      ...(me ? [{ id: "act:pause", kind: "action" as const, label: me.shelfPaused ? p.resumeShelf : p.pauseShelf, more: `${p.pauseShelf} ${p.resumeShelf}`, icon: <IconShelf width={18} height={18} />, run: () => void setPaused(!me.shelfPaused), transient: true }] : []),
      ...LOCALES.filter((l) => l !== locale).map((l) => ({ id: `act:lang:${l}`, kind: "action" as const, label: p.language(localeName[l]), more: l, icon: <Glyph>{l}</Glyph>, run: () => void setLocale(l), transient: true })),
      { id: "act:help", kind: "action", label: p.showShortcuts, icon: <Glyph>?</Glyph>, run: onHelp, transient: true },
    ];
    const pages: Item[] = [
      ...SHORTCUTS.filter((s) => s.group === "go" && s.href).map((s) => ({ id: `page:${s.id}`, kind: "page" as const, label: s.label(m), icon: pageIcon[s.id], href: s.href!, keys: s.keys })),
      { id: "page:search", kind: "page", label: m.nav.search, icon: pageIcon.searchPage, href: "/suche" },
      { id: "page:calendar", kind: "page", label: m.nav.calendar, icon: pageIcon.calendar, href: "/regal/kalender" },
      ...(me && me.role !== "member" ? [{ id: "page:moderation", kind: "page" as const, label: m.nav.moderation, icon: pageIcon.moderation, href: "/moderation" }] : []),
      { id: "page:help", kind: "page", label: m.nav.help, icon: <Glyph>i</Glyph>, href: "/hilfe" },
    ];
    const loans: Item[] = (d?.loans ?? []).map((x) => ({
      id: `loan:${x.id}`, kind: "loan", label: x.title, serif: true, sub: p.withPerson(status[x.status], x.other_first_name),
      note: x.turn_is_mine ? p.yourTurn : undefined, more: x.turn_is_mine ? p.yourTurn : "", icon: kindIcon.loan, href: `/vorgaenge/${x.id}`,
    }));
    const books: Item[] = (d?.books ?? []).map((b) => ({ id: `book:${b.id}`, kind: "book", label: b.title, serif: true, sub: b.authors.join(", ") || undefined, icon: kindIcon.book, href: `/regal/${b.id}` }));
    const circles: Item[] = (d?.circles ?? []).map((c) => ({ id: `circle:${c.id}`, kind: "circle", label: c.name, icon: kindIcon.circle, href: `/kreise/${c.id}` }));
    const found: Item[] = wantTitles ? titles.hits.map((h) => ({ id: `title:${h.work_id}`, kind: "title", label: h.title, serif: true, sub: h.authors.join(", ") || undefined, icon: kindIcon.title, href: `/titel/${h.work_id}` })) : [];

    // Zuletzt Benutztes: Aktionen und Seiten in der heutigen Sprache, Bücher/Vorgänge/Kreise aus dem frischen Stand
    const live = new Map([...actions, ...pages, ...loans, ...books, ...circles].map((it) => [it.id, it]));
    const recent: Item[] = recents.flatMap((r): Item[] => {
      const now = live.get(r.id);
      if (now) return [now];
      // Geladen und nicht mehr vorhanden (Buch entfernt, Vorgang abgeschlossen): nicht mehr anbieten
      if (d && (r.kind === "loan" || r.kind === "book" || r.kind === "circle")) return [];
      if (r.kind === "action" || r.kind === "page") return [];
      return [{ id: r.id, kind: r.kind, label: r.label, sub: r.sub, serif: r.kind !== "circle", icon: kindIcon[r.kind] ?? kindIcon.page, href: r.href }];
    });

    const seen = new Set<string>();
    const pick = (items: Item[], max: number) => {
      const out: Item[] = [];
      for (const it of items) {
        if (out.length >= max) break;
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
      }
      return out;
    };
    const waiting = online && !d && data.status !== "error";
    const failed = data.status === "error" ? p.loadError : undefined;

    if (!q) {
      return [
        { id: "recent", label: p.groups.recent, items: pick(recent, RECENT_MAX) },
        { id: "actions", label: p.groups.actions, items: pick(actions, 8) },
        { id: "loans", label: p.groups.loans, items: pick(loans, 5), loading: waiting, error: failed },
      ];
    }
    const hit = matcher(q);
    const searchItem: Item = { id: "search:open", kind: "search", label: p.openSearch(q), icon: kindIcon.search, href: `/suche?q=${encodeURIComponent(q)}`, transient: true };
    return [
      { id: "recent", label: p.groups.recent, items: pick(recent.filter(hit), RECENT_MAX) },
      { id: "actions", label: p.groups.actions, items: pick(actions.filter(hit), 6) },
      { id: "loans", label: p.groups.loans, items: pick(loans.filter(hit), 5), loading: waiting, error: failed },
      { id: "books", label: p.groups.books, items: pick(books.filter(hit), 6) },
      { id: "circles", label: p.groups.circles, items: pick(circles.filter(hit), 5) },
      { id: "pages", label: p.groups.pages, items: pick(pages.filter(hit), 6) },
      { id: "titles", label: p.groups.titles, items: pick(found, 6), loading: titlesPending && found.length === 0, error: wantTitles && !titlesPending && titles.status === "error" ? p.searchError : undefined },
      { id: "search", label: p.groups.search, items: [searchItem] },
    ];
  }, [data, locale, m, me, onHelp, online, p, q, recents, setLocale, setPaused, titles, titlesPending, wantTitles]);

  // «Erneut laden» ist selbst ein Eintrag der Liste: mit den Pfeiltasten erreichbar, der Fokus bleibt im Feld
  const shown = useMemo(() => groups
    .map((g) => (g.error && g.id === "loans" ? { ...g, items: [...g.items, { id: "retry", kind: "action" as const, label: p.retry, icon: kindIcon.action, run: reload, keep: true, transient: true }] } : g))
    .filter((g) => g.items.length > 0 || g.loading || g.error), [groups, p.retry, reload]);
  const options = useMemo(() => shown.flatMap((g) => g.items), [shown]);
  const current = options[Math.min(active, options.length - 1)];
  const optionId = (it: Item) => `${uid}-o-${it.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const busy = shown.some((g) => g.loading);
  const real = options.filter((o) => o.kind !== "search" && o.id !== "retry").length;
  const nothing = q.length > 0 && real === 0 && !busy;

  useEffect(() => {
    if (!current) return;
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    // optionId hängt nur an uid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const run = (it: Item) => {
    if (it.keep) { it.run?.(); return; }
    remember(it);
    onClose();
    if (it.href) router.push(it.href);
    else it.run?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = options.length;
    const i = Math.min(active, n - 1);
    const go = (to: number) => { e.preventDefault(); if (n) setActive((to + n) % n); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home" && n) go(0);
    else if (e.key === "End" && n) go(n - 1);
    else if (e.key === "Enter") { e.preventDefault(); if (current) run(current); }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 pl-4 pr-2 md:pr-4 border-b border-line">
        <IconSearch width={20} height={20} className="text-muted flex-none" />
        <input
          type="text" role="combobox" aria-label={p.placeholder} aria-autocomplete="list" aria-haspopup="listbox"
          aria-expanded={options.length > 0} aria-controls={listId} aria-activedescendant={current ? optionId(current) : undefined}
          value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
          placeholder={p.placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go"
          // Der Fokus bleibt immer hier; die gewählte Zeile trägt die sichtbare Marke
          className="flex-1 min-w-0 h-14 bg-transparent text-body-lg placeholder:text-muted outline-none"
        />
        <kbd aria-hidden className={cx(kbdCls, "hidden md:inline-block")}>esc</kbd>
        <button type="button" onClick={onClose} aria-label={p.shortcuts.close} className="md:hidden press h-11 w-11 grid place-items-center rounded-sm text-muted hover:text-ink">
          <IconClose />
        </button>
      </div>

      {!online && <p className="px-4 py-2.5 text-body-sm text-ink-2 bg-paper-2 border-b border-line">{p.offline}</p>}

      <div ref={listRef} id={listId} role="listbox" aria-label={p.label} aria-busy={busy}
        className="max-h-[calc(100dvh-180px)] md:max-h-[min(60dvh,460px)] overflow-y-auto overscroll-contain py-2">
        {shown.map((g) => {
          const gid = `${uid}-g-${g.id}`;
          return (
            <div key={g.id} role="group" aria-labelledby={gid}>
              <div id={gid} role="presentation" className="px-4 pt-2.5 pb-1 text-caption font-medium text-muted">{g.label}</div>
              {g.loading && [0, 1, 2].slice(0, g.id === "titles" ? 2 : 3).map((i) => (
                <div key={i} aria-hidden className="flex items-center gap-3 min-h-11 px-4">
                  <span className="skeleton h-[18px] w-[18px] flex-none" />
                  <span className={cx("skeleton h-3.5", i === 0 ? "w-48" : i === 1 ? "w-36" : "w-56")} />
                </div>
              ))}
              {g.error && <p className="px-4 py-2 text-body-sm text-ink-2">{g.error}</p>}
              {g.items.map((it) => {
                const on = it.id === current?.id;
                return (
                  <div key={it.id} id={optionId(it)} role="option" aria-selected={on}
                    onMouseMove={() => { const i = options.indexOf(it); if (i !== active) setActive(i); }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(it)}
                    className={cx("relative flex items-center gap-3 min-h-11 px-4 py-1.5 cursor-pointer select-none", on && "bg-paper-2")}>
                    {on && <span aria-hidden className="absolute left-0 inset-y-1.5 w-[3px] rounded-full bg-ink" />}
                    <span className={cx("flex-none", on ? "text-ink" : "text-muted")}>{it.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span title={it.label} className={cx("block truncate", it.serif ? "font-serif text-body" : "text-body")}>{it.label}</span>
                      {it.sub && <span className="block truncate text-meta text-muted">{it.sub}</span>}
                    </span>
                    {it.note && <span className="chip flex-none">{it.note}</span>}
                    {it.keys && <span className="hidden md:inline-flex"><Keys keys={it.keys} mac={mac} /></span>}
                    {on && <kbd aria-hidden className={cx(kbdCls, "hidden md:inline-block flex-none")}>↵</kbd>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {nothing && <p className="px-4 pt-1 pb-2 text-body-sm text-muted">{p.noResults}</p>}
      </div>

      <div aria-hidden className="hidden md:flex items-center gap-5 px-4 h-10 border-t border-line text-caption text-muted">
        <span className="inline-flex items-center gap-1.5"><kbd className={kbdCls}>↑</kbd><kbd className={kbdCls}>↓</kbd> {p.hintMove}</span>
        <span className="inline-flex items-center gap-1.5"><kbd className={kbdCls}>↵</kbd> {p.hintRun}</span>
        <span className="inline-flex items-center gap-1.5"><kbd className={kbdCls}>esc</kbd> {p.hintClose}</span>
      </div>

      <p role="status" aria-live="polite" className="sr-only">{busy ? "" : nothing ? p.noResults : p.count(options.length)}</p>
    </div>
  );
}
