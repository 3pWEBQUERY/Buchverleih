"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShelfCopy, ShelfStatus } from "@/lib/copies";
import type { OfferKind } from "@/lib/loans/machine";
import { api } from "@/lib/client";
import { offerLabel, visibilityLabel } from "@/lib/i18n/de-CH";
import { Cover } from "@/components/cover";
import Link from "next/link";
import { BookRow } from "./book-row";
import { useToast } from "@/components/toast";
import { Button, LinkButton, PageTitle, Switch, cx } from "@/components/ui";
import { IconCalendar, IconCheck, IconScan } from "@/components/icons";

type Visibility = ShelfCopy["visibility"];
type Bulk = { offers?: OfferKind[]; visibility?: Visibility; loanDays?: 14 | 28 | 42 | 56 };

const GROUPS: { key: string; label: string; statuses: ShelfStatus[] }[] = [
  { key: "lent", label: "Ausgeliehen", statuses: ["lent"] },
  { key: "booked", label: "Gebucht und angefragt", statuses: ["reserved", "requested"] },
  { key: "available", label: "Verfügbar", statuses: ["available", "paused"] },
  { key: "off", label: "Nicht angeboten", statuses: ["not_offered"] },
];

const OFFER_OPTIONS: { label: string; offers: OfferKind[] }[] = [
  { label: "Leihen", offers: ["lend"] },
  { label: "Leihen und Tauschen", offers: ["lend", "swap"] },
  { label: "Tauschen", offers: ["swap"] },
  { label: "Verschenken", offers: ["gift"] },
  { label: "Nicht angeboten", offers: [] },
];
const VIS_OPTIONS: Visibility[] = ["all", "proven", "circles"];
const DAYS_OPTIONS = [14, 28, 42, 56] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function RegalView({ copies, loanDays, paused: initialPaused }: { copies: ShelfCopy[]; loanDays: Record<string, number>; paused: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [paused, setPaused] = useState(initialPaused);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"offers" | "visibility" | "loanDays" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPaused(initialPaused), [initialPaused]);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stopSelecting();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: copies.filter((c) => g.statuses.includes(c.status)) })).filter((g) => g.items.length > 0),
    [copies],
  );

  const count = (s: ShelfStatus[]) => copies.filter((c) => s.includes(c.status)).length;
  const lent = count(["lent"]);
  const requests = copies.reduce((n, c) => n + c.open_requests, 0);
  const summary = [plural(copies.length, "Buch", "Bücher"), lent ? `${lent} ausgeliehen` : null, requests ? plural(requests, "offene Anfrage", "offene Anfragen") : null]
    .filter(Boolean)
    .join(" · ");

  function stopSelecting() {
    setSelecting(false);
    setSel(new Set());
    setPanel(null);
  }

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function togglePause(v: boolean) {
    setPaused(v);
    try {
      await api("/me", { method: "PATCH", body: { shelfPaused: v } });
      toast.show({
        text: v ? "Ferienmodus ist an. Anfragen sind pausiert." : "Ferienmodus ist aus. Dein Regal nimmt wieder Anfragen an.",
        undo: async () => {
          setPaused(!v);
          await api("/me", { method: "PATCH", body: { shelfPaused: !v } });
          router.refresh();
        },
      });
      router.refresh();
    } catch (e) {
      setPaused(!v);
      toast.error((e as Error).message);
    }
  }

  async function apply(change: Bulk, label: string) {
    const ids = [...sel];
    if (!ids.length) return;
    const chosen = copies.filter((c) => sel.has(c.id));
    // Vorherige Werte gruppieren, damit «Rückgängig» jedes Buch auf seinen alten Stand setzt
    const prev = new Map<string, { ids: string[]; body: Bulk }>();
    for (const c of chosen) {
      const body: Bulk = change.offers ? { offers: c.offers } : change.visibility ? { visibility: c.visibility } : { loanDays: (loanDays[c.id] ?? 28) as Bulk["loanDays"] };
      const k = JSON.stringify(body);
      const g = prev.get(k) ?? { ids: [], body };
      g.ids.push(c.id);
      prev.set(k, g);
    }
    setBusy(true);
    try {
      await api("/copies", { method: "PATCH", body: { ids, ...change } });
      setPanel(null);
      toast.show({
        text: `${plural(ids.length, "Buch", "Bücher")}: ${label}`,
        undo: async () => {
          try {
            for (const g of prev.values()) await api("/copies", { method: "PATCH", body: { ids: g.ids, ...g.body } });
            router.refresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        },
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (copies.length === 0) {
    return (
      <div>
        <PageTitle sub="Alles, was du verleihst, tauschst oder verschenkst, steht hier.">Mein <em>Regal</em></PageTitle>
        <section className="rounded-[22px] bg-accent text-accent-ink p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <p className="eyebrow !text-accent-ink/75">Dein Regal ist noch leer</p>
            <h2 className="display text-[44px] md:text-[64px] mt-3 max-w-[14ch]">Ein Buch einstellen dauert <em>unter 20 Sekunden.</em></h2>
          </div>
          <Link href="/regal/neu" className="h-14 px-7 rounded-full bg-night text-night-ink font-semibold inline-flex items-center gap-2 justify-center"><IconScan width={20} height={20} /> Erstes Buch scannen</Link>
        </section>
      </div>
    );
  }

  const tiles: [number, string][] = [
    [copies.length, copies.length === 1 ? "Buch" : "Bücher"],
    [lent, "ausgeliehen"],
    [requests, requests === 1 ? "Anfrage" : "Anfragen"],
  ];

  return (
    <div className={cx(selecting ? "pb-48" : "")}>
      <header className="mb-10 md:mb-12 grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-8 items-end">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">{summary}</p>
          <h1 className="display text-[52px] md:text-[84px] mt-3">Mein <em>Regal</em></h1>
        </div>
        <dl className="grid grid-cols-3 gap-2 anim-rise" style={{ animationDelay: "80ms" }}>
          {tiles.map(([n, l], i) => (
            <div key={l} className="panel-quiet px-4 md:px-5 py-4 lg:min-w-[124px]">
              <dd className="font-serif text-[40px] leading-none tnum flex items-center gap-2">
                {n}
                {i === 2 && n > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-accent live-dot" />}
              </dd>
              <dt className="text-[13px] text-muted mt-1.5">{l}</dt>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-6 anim-rise" style={{ animationDelay: "120ms" }}>
        <span className="hidden md:contents">
          <LinkButton href="/regal/neu" variant="primary" title="Tastenkürzel n">
            <IconScan /> Buch scannen <kbd className="font-sans text-xs opacity-75 border border-current/40 rounded-[4px] px-1">n</kbd>
          </LinkButton>
        </span>
        <LinkButton href="/regal/kalender" variant="ghost"><IconCalendar width={18} height={18} /> Kalender</LinkButton>
        <Button variant={selecting ? "secondary" : "ghost"} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
          {selecting ? <><IconCheck width={18} height={18} /> Fertig</> : "Mehrere ändern"}
        </Button>
        {paused && <span className="chip ml-auto"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-done" />Ferienmodus</span>}
      </div>

      {selecting ? (
        <SelectGrid copies={copies} sel={sel} toggle={toggle} setSel={setSel} />
      ) : (
        <>
          {/* Das Büchergestell: eine dunkle Fläche, jede Gruppe ein Brett */}
          <div className="surface-night rounded-[22px] px-5 md:px-9 pt-7 md:pt-9 pb-4 md:pb-6 -mx-1 md:mx-0">
            {groups.map((g, gi) => (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className={cx(gi > 0 && "mt-8 md:mt-10")}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id={`g-${g.key}`} className="font-serif text-[28px] md:text-[36px] leading-none">{g.label}</h2>
                  <span className="text-[13px] text-night-muted tnum">{plural(g.items.length, "Buch", "Bücher")}</span>
                </div>
                <BookRow items={g.items} />
              </section>
            ))}
          </div>

          <section className="mt-10 md:mt-12 panel px-5 md:px-8 py-3 md:py-4 grid md:grid-cols-[1fr_auto] gap-2 items-center">
            <Switch
              checked={paused}
              onChange={togglePause}
              label={<span className="font-semibold">{paused ? "Ferienmodus ist an" : "Ferienmodus"}</span>}
              hint={paused ? "Dein Regal bleibt sichtbar, Anfragen sind gerade nicht möglich. Laufende Leihen gehen normal weiter." : "Dein Regal bleibt sichtbar, neue Anfragen sind nicht möglich. Laufende Leihen gehen weiter."}
            />
          </section>
        </>
      )}

      {selecting && (
        <div className="fixed z-30 inset-x-0 md:left-[256px] bottom-[calc(68px+env(safe-area-inset-bottom))] md:bottom-0 bg-paper border-t border-line anim-sheet">
          <div className="max-w-[1240px] px-4 md:px-12 lg:px-16 py-3">
            {panel && (
              <div className="pb-3 mb-3 border-b border-line">
                <p className="text-[13px] font-semibold mb-2.5">
                  {panel === "offers" ? "Angebot für die Auswahl" : panel === "visibility" ? "Wer die Auswahl sehen darf" : "Leihfrist für die Auswahl"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {panel === "offers" &&
                    OFFER_OPTIONS.map((o) => (
                      <Button key={o.label} size="sm" disabled={busy} onClick={() => apply({ offers: o.offers }, o.offers.length ? o.label : "nicht angeboten")}>
                        {o.label}
                      </Button>
                    ))}
                  {panel === "visibility" &&
                    VIS_OPTIONS.map((v) => (
                      <Button key={v} size="sm" disabled={busy} onClick={() => apply({ visibility: v }, `sichtbar für ${visibilityLabel[v].toLowerCase().replace("nur meine", "deine")}`)}>
                        {visibilityLabel[v]}
                      </Button>
                    ))}
                  {panel === "loanDays" &&
                    DAYS_OPTIONS.map((d) => (
                      <Button key={d} size="sm" disabled={busy} onClick={() => apply({ loanDays: d }, `Leihfrist ${d} Tage`)}>
                        {d} Tage
                      </Button>
                    ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm tnum whitespace-nowrap flex items-center gap-2" aria-live="polite">
                <span className="h-8 min-w-8 px-2 rounded-full bg-ink text-paper grid place-items-center font-semibold">{sel.size}</span> <span className="text-muted hidden sm:inline">ausgewählt</span>
              </p>
              <div className="flex items-center gap-1 overflow-x-auto" role="toolbar" aria-label="Aktionen für die Auswahl">
                {([
                  ["offers", "Angebot"],
                  ["visibility", "Sichtbarkeit"],
                  ["loanDays", "Leihfrist"],
                ] as const).map(([k, l]) => (
                  <Button key={k} size="sm" variant={panel === k ? "secondary" : "ghost"} disabled={sel.size === 0} aria-expanded={panel === k}
                    onClick={() => setPanel(panel === k ? null : k)}>
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectGrid({ copies, sel, toggle, setSel }: { copies: ShelfCopy[]; sel: Set<string>; toggle: (id: string) => void; setSel: (s: Set<string>) => void }) {
  const all = sel.size === copies.length;
  return (
    <section aria-label="Bücher auswählen">
      <div className="flex items-center justify-between gap-4 panel-quiet px-5 py-3 mb-6">
        <p className="text-[15px] text-ink-2">Tippe die Bücher an, die du gemeinsam ändern willst.</p>
        <Button variant="quiet" className="text-sm" onClick={() => setSel(all ? new Set() : new Set(copies.map((c) => c.id)))}>
          {all ? "Keine" : "Alle auswählen"}
        </Button>
      </div>
      <ul className="grid gap-x-3 gap-y-5 grid-cols-[repeat(auto-fill,minmax(76px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
        {copies.map((c) => {
          const on = sel.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" aria-pressed={on} onClick={() => toggle(c.id)} className="group block w-full text-left">
                <div className="relative flex items-end justify-center h-[112px] md:h-[136px]">
                  <span className={cx("block rounded-xs transition-opacity duration-150", on && "outline-2 outline-ink outline-offset-2", !on && sel.size > 0 && "opacity-60")}>
                    <span className="block md:hidden">
                      <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} height={104} />
                    </span>
                    <span className="hidden md:block">
                      <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} height={128} />
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full border transition-colors duration-150",
                      on ? "bg-ink border-ink text-paper" : "bg-paper/90 border-line-strong text-transparent group-hover:border-ink",
                    )}
                  >
                    <IconCheck width={15} height={15} strokeWidth={2} />
                  </span>
                </div>
                <span className="block text-xs leading-snug line-clamp-2 mt-2">{c.title}</span>
                <span className="block text-xs text-muted mt-0.5">{c.offers.length ? c.offers.map((o) => offerLabel[o]).join(", ") : "Nicht angeboten"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
