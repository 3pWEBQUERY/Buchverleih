"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShelfCopy, ShelfStatus } from "@/lib/copies";
import type { OfferKind } from "@/lib/loans/machine";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { SHELF } from "@/lib/i18n/messages/shelf";
import { Cover } from "@/components/cover";
import Link from "next/link";
import { BookRow } from "@/components/regal/book-row";
import { useToast } from "@/components/toast";
import { Button, PageTitle, Switch, cx } from "@/components/ui";
import { IconArrowRight, IconCalendar, IconCheck, IconClose, IconScan, IconSearch } from "@/components/icons";
import { StatTile, StepSection } from "@/components/step-section";
import { timeMeter, TimeMeterInline } from "@/components/loan/loan-row";

type Visibility = ShelfCopy["visibility"];
type Bulk = { offers?: OfferKind[]; visibility?: Visibility; loanDays?: 14 | 28 | 42 | 56 };

const GROUPS: { key: "lent" | "booked" | "available" | "off"; statuses: ShelfStatus[] }[] = [
  { key: "lent", statuses: ["lent"] },
  { key: "booked", statuses: ["reserved", "requested"] },
  { key: "available", statuses: ["available", "paused"] },
  { key: "off", statuses: ["not_offered"] },
];

const OFFER_OPTIONS: { key: "lend" | "lendSwap" | "swap" | "gift" | "none"; offers: OfferKind[] }[] = [
  { key: "lend", offers: ["lend"] },
  { key: "lendSwap", offers: ["lend", "swap"] },
  { key: "swap", offers: ["swap"] },
  { key: "gift", offers: ["gift"] },
  { key: "none", offers: [] },
];
const VIS_OPTIONS: Visibility[] = ["all", "proven", "circles"];
const DAYS_OPTIONS = [14, 28, 42, 56] as const;

export function RegalView({ copies, loanDays, paused: initialPaused }: { copies: ShelfCopy[]; loanDays: Record<string, number>; paused: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const l = useLocale();
  const t = SHELF[l];
  const L = labels(l);
  const [paused, setPaused] = useState(initialPaused);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"offers" | "visibility" | "loanDays" | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("alle");
  const [q, setQ] = useState("");

  useEffect(() => setPaused(initialPaused), [initialPaused]);
  // Während der Mehrfachauswahl steht unten eine Leiste: Hinweise (Rückgängig) darüber setzen
  useEffect(() => {
    if (!selecting) return;
    document.body.dataset.sheet = "1";
    return () => { delete document.body.dataset.sheet; };
  }, [selecting]);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stopSelecting();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const needle = q.trim().toLowerCase();
  const matches = (c: ShelfCopy) => !needle || c.title.toLowerCase().includes(needle) || c.authors.some((a) => a.toLowerCase().includes(needle));
  const allGroups = useMemo(
    () => GROUPS.map((g) => ({ ...g, label: t.groups[g.key], items: copies.filter((c) => g.statuses.includes(c.status)) })).filter((g) => g.items.length > 0),
    [copies, t],
  );
  const groups = allGroups
    .filter((g) => filter === "alle" || g.key === filter)
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0);
  const lentCopies = copies.filter((c) => c.status === "lent").sort((a, b) => new Date(a.lent_until ?? 0).getTime() - new Date(b.lent_until ?? 0).getTime());
  const asked = copies.filter((c) => c.open_requests > 0);

  const count = (s: ShelfStatus[]) => copies.filter((c) => s.includes(c.status)).length;
  const lent = count(["lent"]);
  const requests = copies.reduce((n, c) => n + c.open_requests, 0);
  const summary = [t.books(copies.length), lent ? t.lentCount(lent) : null, requests ? t.openRequests(requests) : null]
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
        text: v ? t.pauseOn : t.pauseOff,
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
        text: `${t.books(ids.length)}: ${label}`,
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
        <PageTitle sub={t.emptySub}>{t.heading[0]}<em>{t.heading[1]}</em></PageTitle>
        <section className="rounded-[12px] bg-accent text-accent-ink p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <p className="eyebrow !text-accent-ink/75">{t.emptyEyebrow}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-3 max-w-[14ch]">{t.emptyTitle[0]}<em>{t.emptyTitle[1]}</em></h2>
          </div>
          <Link href="/regal/neu" className="h-14 px-7 rounded-[6px] bg-night-ink text-accent-hover font-semibold inline-flex items-center gap-2 justify-center"><IconScan width={20} height={20} /> {t.firstScan}</Link>
        </section>
      </div>
    );
  }

  const free = count(["available"]);
  let n = 0;

  return (
    <div className={cx(selecting ? "pb-48" : "")}>
      <PageTitle eyebrow={summary}
        aside={
          <dl className="grid grid-cols-4 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={copies.length} label={t.bookWord(copies.length)} href="#regal" />
            <StatTile n={free} label={t.stat.free} href="#regal" />
            <StatTile n={lent} label={t.stat.lent} href={lent ? "#unterwegs" : null} />
            <StatTile n={requests} label={t.requestWord(requests)} href={requests ? "/vorgaenge?seite=verleihe" : null} live={requests > 0} />
          </dl>
        }>
        {t.heading[0]}<em>{t.heading[1]}</em>
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2 mb-2 anim-rise" style={{ animationDelay: "100ms" }}>
        <Link href="/regal/neu" title={t.shortcut} className="h-11 px-4 rounded-[6px] bg-accent text-accent-ink font-medium text-[14.5px] hidden md:inline-flex items-center gap-2 hover:bg-accent-hover transition-colors">
          <IconScan width={18} height={18} /> {t.addBook} <kbd className="hidden md:inline font-sans text-[11px] opacity-75 border border-current/40 rounded-[4px] px-1 leading-4">n</kbd>
        </Link>
        <Link href="/regal/kalender" className="h-11 px-4 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
          <IconCalendar width={18} height={18} /> {t.calendar}
        </Link>
        <button type="button" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          className={cx("h-11 px-4 rounded-[6px] border font-medium text-[14.5px] inline-flex items-center gap-2 transition-colors",
            selecting ? "border-accent bg-accent-soft/40 text-accent-hover" : "border-line-strong hover:border-ink-2")}>
          {selecting ? <><IconCheck width={18} height={18} /> {t.done}</> : t.editMany}
        </button>
        {paused && <a href="#ferien" className="ml-auto inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] bg-paper-2 text-ink-2 text-[13px] font-medium"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait" />{t.pausedChip}</a>}
      </div>

      {selecting ? (
        <div className="mt-8"><SelectGrid copies={copies} sel={sel} toggle={toggle} setSel={setSel} /></div>
      ) : (
        <>
          {lentCopies.length > 0 && (
            <StepSection id="unterwegs" n={++n} first title={t.onTheWay} aside={t.books(lentCopies.length)}
              desc={t.onTheWayDesc} className="mt-8">
              <ul className="grid xl:grid-cols-2 gap-3">
                {lentCopies.map((c, i) => {
                  const m = c.lent_until ? timeMeter({ status: "active", kind: "lend", role: "owner", other_name: c.lent_to ?? t.thePerson, wanted: "", due_at: c.lent_until,
                    respond_by: new Date(), requested_at: new Date(), handed_over_at: c.lent_since ?? null, handover_by: null, returned_at: null, inspection_until: null }, l) : null;
                  return (
                    <li key={c.id} className="anim-rise min-w-0" style={{ animationDelay: `${i * 40}ms` }}>
                      <Link href={c.loan_id ? `/vorgaenge/${c.loan_id}` : `/regal/${c.id}`}
                        className={cx("group h-full rounded-[10px] border p-4 grid grid-cols-[48px_minmax(0,1fr)_auto] gap-4 items-start transition-colors",
                          m?.tone === "late" ? "border-late/50 hover:border-late" : "border-line hover:border-accent")}>
                        <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} width={48} height={72} uniform l={l} />
                        <div className="min-w-0">
                          <p className="text-[12.5px] text-muted">{t.at(c.lent_to ?? null)}</p>
                          <p className="font-serif text-[18px] leading-[1.15] mt-0.5 line-clamp-2 group-hover:underline underline-offset-4 decoration-1">{c.title}</p>
                          {m && <TimeMeterInline m={m} className="mt-2.5" l={l} />}
                        </div>
                        <IconArrowRight width={16} height={16} className="text-accent-hover mt-1 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </StepSection>
          )}

          {asked.length > 0 && (
            <StepSection id="anfragen" n={++n} first={n === 1} title={t.waiting} aside={t.requests(requests)}
              desc={t.waitingDesc} className={n === 1 ? "mt-8" : undefined}>
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {asked.map((c, i) => (
                  <li key={c.id} className="anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                    <Link href="/vorgaenge?seite=verleihe" className="group h-full rounded-[10px] border border-accent/40 bg-accent-soft/15 p-4 grid grid-cols-[40px_minmax(0,1fr)] gap-3.5 items-center hover:border-accent transition-colors">
                      <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} width={40} height={60} uniform l={l} />
                      <div className="min-w-0">
                        <p className="font-serif text-[17px] leading-tight truncate">{c.title}</p>
                        <p className="text-[13px] font-medium text-accent-hover mt-1 inline-flex items-center gap-1.5">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />{t.answer(c.open_requests)}
                          <IconArrowRight width={13} height={13} className="transition-transform group-hover:translate-x-0.5" />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </StepSection>
          )}

          <StepSection id="regal" n={++n} first={n === 1} title={t.yourShelf} aside={t.books(copies.length)}
            desc={t.yourShelfDesc} className={n === 1 ? "mt-8" : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div role="group" aria-label={t.filterAria} className="flex flex-wrap gap-1.5">
                {[{ key: "alle", label: t.all, n: copies.length }, ...allGroups.map((g) => ({ key: g.key, label: g.label, n: g.items.length }))].map((f) => {
                  const on = filter === f.key;
                  return (
                    <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(f.key)}
                      className={cx("h-9 pl-3 pr-1.5 rounded-[8px] border text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors",
                        on ? "border-accent bg-accent-soft/40 text-accent-hover" : "border-line text-ink-2 hover:border-ink-2")}>
                      {f.label}
                      <span className={cx("h-6 min-w-6 px-1.5 rounded-[5px] text-[12px] grid place-items-center tnum", on ? "bg-accent-soft" : "bg-paper-2 text-muted")}>{f.n}</span>
                    </button>
                  );
                })}
              </div>
              <label className="relative w-full sm:w-[260px]">
                <span className="sr-only">{t.search}</span>
                <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch width={16} height={16} /></span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
                  className="w-full h-10 rounded-[8px] border border-line-strong bg-paper pl-9 pr-9 text-[14.5px] placeholder:text-muted/80 [&::-webkit-search-cancel-button]:appearance-none hover:border-ink-2 focus:outline-none focus:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 transition-colors" />
                {q && (
                  <button type="button" onClick={() => setQ("")} aria-label={t.clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-[5px] text-muted hover:text-ink hover:bg-paper-3">
                    <IconClose width={14} height={14} />
                  </button>
                )}
              </label>
            </div>

            {groups.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-line-strong p-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-ink-2 text-[15px]">{needle ? t.nothingFor(q.trim()) : t.nothingHere}</p>
                <button type="button" onClick={() => { setQ(""); setFilter("alle"); }} className="text-[14px] font-medium text-accent-hover hover:underline underline-offset-4">{t.showAll}</button>
              </div>
            ) : (
              /* Das Büchergestell: eine dunkle Fläche, jede Gruppe ein Brett */
              <div className="surface-night rounded-[12px] px-5 md:px-8 pt-6 md:pt-7 pb-4 md:pb-5 -mx-1 md:mx-0">
                {groups.map((g, gi) => (
                  <section key={g.key} aria-labelledby={`g-${g.key}`} className={cx(gi > 0 && "mt-8 md:mt-9")}>
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 id={`g-${g.key}`} className="text-[20px] md:text-[24px] font-[560] tracking-[-0.03em] leading-none">{g.label}</h3>
                      <span className="text-[13px] text-night-muted tnum">{t.books(g.items.length)}</span>
                    </div>
                    <BookRow items={g.items} height={156} l={l} />
                  </section>
                ))}
              </div>
            )}
          </StepSection>

          <StepSection id="ferien" n={++n} title={t.pause} desc={t.pauseDesc}>
            <div className={cx("rounded-[10px] border px-5 md:px-6 py-2", paused ? "border-wait/50 bg-wait/[0.06]" : "border-line")}>
              <Switch
                checked={paused}
                onChange={togglePause}
                label={<span className="font-semibold">{paused ? t.pauseIsOn : t.pause}</span>}
                hint={paused ? t.pauseHintOn : t.pauseHintOff}
              />
            </div>
          </StepSection>
        </>
      )}

      {selecting && (
        <div className="fixed z-30 inset-x-0 md:left-[256px] bottom-[calc(68px+env(safe-area-inset-bottom))] md:bottom-0 bg-paper border-t border-line anim-sheet">
          <div className="max-w-[1240px] px-4 md:px-12 lg:px-16 py-3">
            {panel && (
              <div className="pb-3 mb-3 border-b border-line">
                <p className="text-[13px] font-semibold mb-2.5">
                  {t.panel[panel]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {panel === "offers" &&
                    OFFER_OPTIONS.map((o) => (
                      <Button key={o.key} size="sm" disabled={busy} onClick={() => apply({ offers: o.offers }, o.offers.length ? t.offerOptions[o.key] : t.notOffered)}>
                        {t.offerOptions[o.key]}
                      </Button>
                    ))}
                  {panel === "visibility" &&
                    VIS_OPTIONS.map((v) => (
                      <Button key={v} size="sm" disabled={busy} onClick={() => apply({ visibility: v }, t.visibleFor(L.visibilityLabel[v]))}>
                        {L.visibilityLabel[v]}
                      </Button>
                    ))}
                  {panel === "loanDays" &&
                    DAYS_OPTIONS.map((d) => (
                      <Button key={d} size="sm" disabled={busy} onClick={() => apply({ loanDays: d }, t.loanDaysLabel(d))}>
                        {t.daysN(d)}
                      </Button>
                    ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm tnum whitespace-nowrap flex items-center gap-2" aria-live="polite">
                <span className="h-8 min-w-8 px-2 rounded-[6px] bg-accent-soft text-accent-hover grid place-items-center font-semibold">{sel.size}</span> <span className="text-muted hidden sm:inline">{t.selected}</span>
              </p>
              <div className="flex items-center gap-1 overflow-x-auto" role="toolbar" aria-label={t.toolbar}>
                {(["offers", "visibility", "loanDays"] as const).map((k) => (
                  <Button key={k} size="sm" variant={panel === k ? "secondary" : "ghost"} disabled={sel.size === 0} aria-expanded={panel === k}
                    onClick={() => setPanel(panel === k ? null : k)}>
                    {t.actions[k]}
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
  const l = useLocale();
  const t = SHELF[l];
  return (
    <section aria-label={t.selectAria}>
      <div className="flex items-center justify-between gap-4 panel-quiet px-5 py-3 mb-6">
        <p className="text-[15px] text-ink-2">{t.selectHint}</p>
        <Button variant="quiet" className="text-sm" onClick={() => setSel(all ? new Set() : new Set(copies.map((c) => c.id)))}>
          {all ? t.deselect : t.selectAll}
        </Button>
      </div>
      <ul className="grid gap-x-3 gap-y-5 grid-cols-[repeat(auto-fill,minmax(76px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
        {copies.map((c) => {
          const on = sel.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" aria-pressed={on} onClick={() => toggle(c.id)} className="group block w-full text-left">
                <div className="relative flex items-end justify-center h-[112px] md:h-[136px]">
                  <span className={cx("block rounded-xs transition-opacity duration-150", on && "outline-2 outline-accent outline-offset-2", !on && sel.size > 0 && "opacity-60")}>
                    <span className="block md:hidden">
                      <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} height={104} l={l} />
                    </span>
                    <span className="hidden md:block">
                      <Cover data={{ title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id }} height={128} l={l} />
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full border transition-colors duration-150",
                      on ? "bg-accent border-accent text-accent-ink" : "bg-paper/90 border-line-strong text-transparent group-hover:border-accent",
                    )}
                  >
                    <IconCheck width={15} height={15} strokeWidth={2} />
                  </span>
                </div>
                <span className="block text-xs leading-snug line-clamp-2 mt-2">{c.title}</span>
                <span className="block text-xs text-muted mt-0.5">{c.offers.length ? c.offers.map((o) => labels(l).offerLabel[o]).join(", ") : t.notOfferedCap}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
