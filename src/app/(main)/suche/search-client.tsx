"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { BookRow } from "@/components/regal/book-row";
import { StepSection } from "@/components/step-section";
import { useToast } from "@/components/toast";
import { IconSearch, IconClose, IconArrowRight } from "@/components/icons";
import { Button, LinkButton, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { fmtDistance } from "@/lib/geo";
import { genres } from "@/lib/i18n/de-CH";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { SEARCH } from "@/lib/i18n/messages/search";
import type { Locale } from "@/lib/i18n/locale";
import type { WorkHit } from "@/lib/search";
import type { Center } from "./search-map";

// Leaflet nur laden, wenn jemand die Karte öffnet
const SearchMap = dynamic(() => import("./search-map"), {
  ssr: false,
  loading: () => <div className="skeleton rounded-[12px] h-[62vh] min-h-[420px] max-h-[680px]" />,
});
type View = "list" | "map";

export type Filters = {
  radius: number;
  offer: "" | "lend" | "swap" | "gift";
  available: boolean;
  language: string;
  genre: string;
  condition: number;
};

const DEFAULTS: Filters = { radius: 25, offer: "", available: false, language: "", genre: "", condition: 0 };
const RADII = [1, 2, 5, 10, 25];

function urlOf(key: string, view: View) {
  const p = new URLSearchParams(key);
  if (view === "map") p.set("ansicht", "karte");
  const s = p.toString();
  return s ? `/suche?${s}` : "/suche";
}

function paramsOf(q: string, f: Filters, plz: string) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (f.radius !== DEFAULTS.radius) p.set("radius", String(f.radius));
  if (f.offer) p.set("offer", f.offer);
  if (f.available) p.set("available", "1");
  if (f.language) p.set("language", f.language);
  if (f.genre) p.set("genre", f.genre);
  if (f.condition) p.set("condition", String(f.condition));
  if (plz) p.set("plz", plz);
  return p;
}

function activeCount(f: Filters) {
  return (f.radius !== DEFAULTS.radius ? 1 : 0) + (f.offer ? 1 : 0) + (f.available ? 1 : 0) + (f.language ? 1 : 0) + (f.genre ? 1 : 0) + (f.condition ? 1 : 0);
}

export function availabilityText(h: Pick<WorkHit, "copies" | "available_now">, l: Locale = "de") {
  const a = SEARCH[l].avail;
  return h.copies === 1 ? a.one(h.available_now > 0) : a.many(h.copies, h.available_now);
}

/** Kurzform für den Chip auf der Karte */
function availabilityChip(h: Pick<WorkHit, "copies" | "available_now">, l: Locale) {
  const a = SEARCH[l].avail;
  return h.copies === 1 ? a.chipOne(h.available_now > 0) : a.chipMany(h.copies, h.available_now);
}

const coverOf = (h: WorkHit) => ({
  title: h.title, authors: h.authors, photoKey: h.cover?.photo_key, photoW: h.cover?.photo_w, photoH: h.cover?.photo_h, coverKey: h.cover?.cover_key, seed: h.work_id,
});

export function SearchClient({
  loggedIn, autoFocus, initialQ, initialPlz, initialPlace, initialFilters, initialResults, initialCenter, initialView,
}: {
  loggedIn: boolean;
  autoFocus: boolean;
  initialQ: string;
  initialPlz: string;
  initialPlace: string | null;
  initialFilters: Filters;
  initialResults: WorkHit[] | null;
  initialCenter: Center | null;
  initialView: View;
}) {
  const router = useRouter();
  const l = useLocale();
  const t = SEARCH[l];
  const [q, setQ] = useState(initialQ);
  const [f, setF] = useState<Filters>(initialFilters);
  const [plz, setPlz] = useState(initialPlz);
  const [place, setPlace] = useState<string | null>(initialPlace);
  const [results, setResults] = useState<WorkHit[] | null>(initialResults);
  const [resultsFor, setResultsFor] = useState(initialQ.trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<Center | null>(initialCenter);
  const [view, setView] = useState<View>(initialView);
  const viewRef = useRef(view);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const lastQ = useRef(initialQ);
  const hasOrigin = loggedIn || !!plz;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const key = useMemo(() => paramsOf(q, f, loggedIn ? "" : plz).toString(), [q, f, plz, loggedIn]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initialResults !== null || (!hasOrigin && !q.trim())) return;
    }
    const qChanged = lastQ.current !== q;
    lastQ.current = q;
    const target = urlOf(key, viewRef.current);
    if (window.location.pathname === "/suche" && window.location.pathname + window.location.search !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
    if (!hasOrigin && !q.trim()) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const p = paramsOf(q, f, loggedIn ? "" : plz);
        p.delete("radius");
        p.set("radius", String(f.radius));
        const r = await fetch(`/api/v1/search?${p}`, { signal: ctrl.signal, credentials: "same-origin" });
        if (!r.ok) throw new Error();
        const data = (await r.json()) as { results: WorkHit[]; center?: Center | null };
        setResults(data.results);
        if (data.center !== undefined) setCenter(data.center);
        setResultsFor(q.trim());
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(SEARCH[l].error);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, qChanged ? 200 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function switchView(v: View) {
    setView(v);
    viewRef.current = v;
    if (window.location.pathname === "/suche") window.history.replaceState(window.history.state, "", urlOf(key, v));
  }

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));
  const n = activeCount(f);
  const href = (h: WorkHit) => `/titel/${h.work_id}${!loggedIn && plz ? `?plz=${plz}` : ""}`;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results?.length) {
      e.preventDefault();
      router.push(href(results[0]));
    }
    if (e.key === "Escape" && q) {
      e.preventDefault();
      setQ("");
    }
  }

  const summary = results
    ? resultsFor
      ? `${t.titles(results.length)}${hasOrigin ? t.inRadius(f.radius, place) : ""}`
      : `${t.titles(results.length)}${t.inRadius(f.radius, place)}`
    : null;

  // Ohne Suchbegriff: die nächsten freien Titel als Regal auf der dunklen Bühne, der Rest als Karten
  const browsing = !!results && !resultsFor;
  const stage = browsing && results.length >= 6 ? results.filter((h) => h.available_now > 0).slice(0, 12) : [];
  const onStage = new Set(stage.map((h) => h.work_id));
  const rest = results ? results.filter((h) => !onStage.has(h.work_id)) : [];

  return (
    <div>
      <header className="mb-8 md:mb-10 anim-rise">
        <p className="eyebrow">{t.eyebrow(place)}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h1>
        <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 max-w-xl leading-relaxed">{t.lead}</p>
      </header>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative anim-rise" style={{ animationDelay: "40ms" }}>
        <label htmlFor="suche-q" className="sr-only">{t.inputLabel}</label>
        <span aria-hidden className="absolute left-5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          <IconSearch width={20} height={20} />
        </span>
        <input
          id="suche-q"
          ref={inputRef}
          data-search-input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.inputLabel}
          className="w-full h-14 md:h-[60px] bg-paper border border-line-strong rounded-[10px] pl-13 pr-14 text-[17px] md:text-[18px] tracking-[-0.01em] placeholder:text-muted/80 hover:border-ink-2 focus:outline-none focus:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 transition-colors duration-150 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label={t.clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-[6px] text-ink-2 hover:bg-paper-2 hover:text-ink transition-colors">
            <IconClose />
          </button>
        ) : (
          <kbd aria-hidden className="hidden md:grid absolute right-5 top-1/2 -translate-y-1/2 h-7 w-7 place-items-center text-[13px] text-muted border border-line-strong rounded-[6px] font-sans">/</kbd>
        )}
      </form>

      {!loggedIn && (
        <PlzBar plz={plz} place={place} onSet={(p, name) => { setPlz(p); setPlace(name); }} />
      )}

      <FilterChips f={f} set={set} reset={() => setF(DEFAULTS)} n={n} hasOrigin={hasOrigin} />

      <div className="mt-10 md:mt-12 min-w-0" aria-busy={loading}>
        <p className="sr-only" aria-live="polite">{summary ?? ""}</p>
        {error && <p role="alert" className="rounded-[10px] bg-late/[0.06] text-late px-5 py-4 mb-5">{error}</p>}

        {results !== null && results.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 md:mb-8">
            <p className="text-[14px] text-muted" aria-hidden>{summary}</p>
            <ViewSwitch view={view} onChange={switchView} t={t.view} />
          </div>
        )}

        {results === null && loading && <ResultSkeleton />}

        {view === "map" && results && results.length > 0 && (
          <SearchMap hits={results} center={center} radiusKm={f.radius} href={href} loading={loading} />
        )}

        {view === "list" && stage.length > 0 && (
          <StepSection id="frei" n={1} first title={t.stageTitle} desc={t.stageDesc(f.radius, place)}
            aside={t.titles(stage.length)}>
            <Stage hits={stage} href={href} />
          </StepSection>
        )}

        {view === "list" && results && rest.length > 0 && (
          <StepSection id="treffer" n={stage.length > 0 ? 2 : 1} first={stage.length === 0}
            title={resultsFor ? <>{t.hitsFor[0]}{resultsFor}{t.hitsFor[1]}</> : stage.length > 0 ? t.allAround : t.around}
            desc={summary ?? undefined}
            aside={<span className={cx("transition-opacity", loading ? "opacity-100" : "opacity-0")}>{t.searching}</span>}>
            <ul className={cx("grid xl:grid-cols-2 gap-3 transition-opacity duration-150", loading && "opacity-60")}>
              {rest.map((h, i) => (
                <ResultCard key={h.work_id} h={h} href={href(h)} i={i} />
              ))}
            </ul>
          </StepSection>
        )}

        {results && results.length === 0 && !loading && (
          <NoHits q={resultsFor} f={f} n={n} loggedIn={loggedIn}
            widen={() => set("radius", 25)} reset={() => setF({ ...DEFAULTS, radius: f.radius })} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Liste/Karte */

function ViewSwitch({ view, onChange, t }: { view: View; onChange: (v: View) => void; t: { label: string; list: string; map: string } }) {
  const opt = (v: View, label: string, icon: React.ReactNode) => (
    <button type="button" role="radio" aria-checked={view === v} onClick={() => onChange(v)}
      className={cx("h-8 px-3 rounded-[5px] inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-colors duration-150",
        view === v ? "bg-paper text-ink border border-line" : "text-ink-2 hover:text-ink border border-transparent")}>
      {icon}{label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label={t.label} className="inline-flex items-center gap-0.5 p-0.5 rounded-[7px] bg-paper-2">
      {opt("list", t.list, <svg aria-hidden viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.5" cy="4" r=".6" fill="currentColor" /><circle cx="2.5" cy="8" r=".6" fill="currentColor" /><circle cx="2.5" cy="12" r=".6" fill="currentColor" /></svg>)}
      {opt("map", t.map, <svg aria-hidden viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5z" /><path d="M5.5 2v10M10.5 4v10" /></svg>)}
    </div>
  );
}

/* ------------------------------------------------------------------ Filter */

const chip = "h-9 px-3.5 rounded-[6px] text-[13.5px] font-medium inline-flex items-center gap-2 whitespace-nowrap flex-none border transition-[background-color,color,border-color] duration-150";
const chipOff = "border-line bg-paper text-ink-2 hover:border-ink-2 hover:text-ink";
const chipOn = "border-accent bg-accent-soft/50 text-accent-hover";

function FilterChips({ f, set, reset, n, hasOrigin }: { f: Filters; set: <K extends keyof Filters>(k: K, v: Filters[K]) => void; reset: () => void; n: number; hasOrigin: boolean }) {
  const l = useLocale();
  const t = SEARCH[l];
  const L = labels(l);
  return (
    <div className="mt-3 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible anim-rise [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ animationDelay: "80ms" }}>
      <div role="group" aria-label={t.filters} className="flex md:flex-wrap items-center gap-2 w-max md:w-full pb-1 md:p-2 md:rounded-[10px] md:bg-paper-2">
        <div role="radiogroup" aria-label={t.radiusAria}
          className={cx("flex-none inline-flex items-center h-9 pl-3 pr-1 gap-0.5 rounded-[6px] border border-line bg-paper", !hasOrigin && "opacity-50 pointer-events-none")}>
          <span className="text-[13px] font-medium text-muted mr-1.5">{t.radius}</span>
          {RADII.map((r) => {
            const on = f.radius === r;
            return (
              <button key={r} type="button" role="radio" aria-checked={on} onClick={() => set("radius", r)}
                className={cx("h-7 min-w-7 px-2 rounded-[4px] text-[13px] font-medium tnum transition-colors duration-150 relative after:absolute after:content-[''] after:-inset-2", on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-paper-2")}>
                {r}{on && <span className="font-medium"> km</span>}
              </button>
            );
          })}
        </div>

        <button type="button" aria-pressed={f.available} onClick={() => set("available", !f.available)} className={cx(chip, f.available ? chipOn : chipOff)}>
          <span aria-hidden className="h-2 w-2 rounded-full bg-ok" /> {t.freeNow}
        </button>

        <span aria-hidden className="h-5 w-px bg-line-strong mx-1 flex-none" />

        {(["lend", "swap", "gift"] as const).map((o) => {
          const on = f.offer === o;
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => set("offer", on ? "" : o)} className={cx(chip, on ? chipOn : chipOff)}>
              {L.offerLabel[o]}
            </button>
          );
        })}

        <span aria-hidden className="h-5 w-px bg-line-strong mx-1 flex-none" />

        <PillSelect label={t.language} value={f.language} onChange={(v) => set("language", v)}
          options={[["", t.allLanguages], ...Object.entries(L.languageLabel)]} />
        <PillSelect label={t.genre} value={f.genre} onChange={(v) => set("genre", v)}
          options={[["", t.allGenres], ...genres.map((g) => [g, L.genreLabel[g] ?? g] as [string, string])]} />
        <PillSelect label={t.condition} value={String(f.condition)} onChange={(v) => set("condition", Number(v))}
          options={[["0", t.anyCondition], ["1", L.conditionLabel[1]], ["2", `${L.conditionLabel[2]} ${t.orBetter}`], ["3", `${L.conditionLabel[3]} ${t.orBetter}`]]} />

        {n > 0 && (
          <button type="button" onClick={reset} className="h-9 px-3 text-[13.5px] font-medium text-accent-hover hover:underline underline-offset-4 flex-none md:ml-auto">
            {t.reset}
          </button>
        )}
      </div>
    </div>
  );
}

function PillSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const on = value !== "" && value !== "0";
  return (
    <label className="relative flex-none">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cx(chip, on ? chipOn : chipOff, "appearance-none [field-sizing:content] pr-8 cursor-pointer focus:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 [&>option]:bg-paper [&>option]:text-ink [&>option]:font-normal")}>
        {options.map(([v, l]) => <option key={v} value={v}>{v === "" || v === "0" ? label : l}</option>)}
      </select>
      <svg aria-hidden viewBox="0 0 12 8" className={cx("absolute right-3 top-1/2 -translate-y-1/2 w-2.5 pointer-events-none", on ? "text-accent-hover" : "text-muted")} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M1 1.5l5 5 5-5" />
      </svg>
    </label>
  );
}

/* ---------------------------------------------------------------- Treffer */

/** «Gleich um die Ecke»: dasselbe Brett wie im Regal, Status immer ganz unten */
function Stage({ hits, href }: { hits: WorkHit[]; href: (h: WorkHit) => string }) {
  const l = useLocale();
  const t = SEARCH[l];
  return (
    <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0 anim-rise">
      <BookRow label={t.stageLabel} height={165}
        items={hits.map((h) => ({
          id: h.work_id, work_id: h.work_id, title: h.title, authors: h.authors,
          photo_key: h.cover?.photo_key ?? null, photo_w: h.cover?.photo_w ?? null, photo_h: h.cover?.photo_h ?? null, cover_key: h.cover?.cover_key ?? null,
          href: href(h), note: { tone: "ok" as const, text: `${t.free}${h.nearest_m != null ? ` · ${fmtDistance(h.nearest_m, l)}` : ""}` },
        }))} />
    </div>
  );
}

function ResultCard({ h, href, i }: { h: WorkHit; href: string; i: number }) {
  const l = useLocale();
  const dist = fmtDistance(h.nearest_m, l);
  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <Link href={href} className="book group rounded-[10px] border border-line h-full grid grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[72px_minmax(0,1fr)] gap-4 md:gap-5 p-4 md:p-5 hover:border-accent transition-colors duration-150">
        <span className="self-start">
          <span className="book-face block md:hidden"><Cover data={coverOf(h)} width={64} height={96} uniform /></span>
          <span className="book-face hidden md:block"><Cover data={coverOf(h)} width={72} height={108} uniform /></span>
        </span>
        <div className="min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-[19px] md:text-[20px] leading-[1.15] line-clamp-2">{h.title}</p>
            {dist && <span className="flex-none text-[13px] font-medium tnum text-ink-2 pt-0.5">{dist}</span>}
          </div>
          {h.authors.length > 0 && <p className="text-[13.5px] text-muted mt-0.5 truncate">{h.authors.join(", ")}</p>}
          <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <span className={cx("inline-flex items-center gap-1.5 font-medium", h.available_now ? "text-ok" : "text-ink-2")}>
              <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", h.available_now ? "bg-ok" : "bg-lent")} />
              <span className="sr-only">{availabilityText(h, l)}</span>
              <span aria-hidden>{availabilityChip(h, l)}</span>
            </span>
            {h.offers.length > 0 && <span className="text-muted">{h.offers.map((o) => labels(l).offerLabel[o]).join(" · ")}</span>}
            <IconArrowRight aria-hidden width={16} height={16} className="ml-auto text-accent-hover opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-200" />
          </div>
        </div>
      </Link>
    </li>
  );
}

function ResultSkeleton() {
  return (
    <ul aria-hidden className="grid xl:grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="rounded-[10px] border border-line flex gap-5 p-5">
          <div className="skeleton w-[72px] h-[108px] flex-none" />
          <div className="flex-1">
            <div className="skeleton h-6" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <div className="skeleton h-3.5 w-1/3 mt-2.5" />
            <div className="skeleton h-6 w-32 mt-8 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------- Postleitzahl (Gäste) */

function PlzBar({ plz, place, onSet }: { plz: string; place: string | null; onSet: (plz: string, place: string | null) => void }) {
  const t = SEARCH[useLocale()].plz;
  const [editing, setEditing] = useState(!plz);
  const [value, setValue] = useState(plz);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(value)) return setErr(t.four);
    try {
      const r = await fetch(`/api/v1/regions/plz/${value}`);
      const d = (await r.json()) as { known: boolean; municipality?: string };
      if (!d.known) return setErr(t.unknown);
      setErr(null);
      setEditing(false);
      onSet(value, d.municipality ?? null);
    } catch {
      setErr(t.offline);
    }
  }

  if (!editing && plz) {
    return (
      <p className="mt-4 text-[14px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] bg-paper-2 text-ink-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> <span className="tnum">{plz}</span>{place && <> {place}</>}</span>
        <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => setEditing(true)}>{t.change}</button>
        <Link href="/anmelden?next=/suche" className="underline underline-offset-4 hover:text-ink">{t.login}</Link>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="mt-4 rounded-[10px] border border-line p-5 md:p-6 flex flex-wrap items-end justify-between gap-4">
      <label htmlFor="suche-plz" className="block text-[15px] text-ink-2 max-w-md">{t.ask}</label>
      <div className="flex items-center gap-2">
        <input id="suche-plz" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="8180" value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} aria-describedby={err ? "suche-plz-err" : undefined}
          className="w-28 h-11 bg-paper border border-line-strong rounded-[6px] px-5 text-[16px] tnum tracking-[0.08em] placeholder:text-muted/70 focus:outline-none focus:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20" />
        <Button type="submit" variant="primary" disabled={value.length !== 4}>{t.show}</Button>
      </div>
      {err && <span id="suche-plz-err" role="alert" className="basis-full block text-sm text-late">{err}</span>}
    </form>
  );
}

/* ----------------------------------------------------------- Keine Treffer */

type CatalogEdition = { id: string; work_id: string; title: string; authors: string[] };

function NoHits({ q, f, n, loggedIn, widen, reset }: { q: string; f: Filters; n: number; loggedIn: boolean; widen: () => void; reset: () => void }) {
  const toast = useToast();
  const t = SEARCH[useLocale()].none;
  const [works, setWorks] = useState<CatalogEdition[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setWorks(null);
    if (!loggedIn || q.length < 2) return;
    let alive = true;
    api<{ editions: CatalogEdition[] }>(`/catalog/search?q=${encodeURIComponent(q)}`)
      .then((d) => {
        if (!alive) return;
        const seen = new Set<string>();
        setWorks(d.editions.filter((e) => (seen.has(e.work_id) ? false : (seen.add(e.work_id), true))).slice(0, 4));
      })
      .catch(() => alive && setWorks([]));
    return () => { alive = false; };
  }, [q, loggedIn]);

  async function wish(workId: string) {
    setBusy(workId);
    try {
      await api("/wishlist", { body: { workId, radiusKm: Math.min(f.radius, 25) } });
      setAdded((s) => new Set(s).add(workId));
      toast.show({ text: t.added });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const sentence = q ? t.forQ(q, f.radius) : t.all(f.radius);

  return (
    <div className="anim-rise space-y-4">
      <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6">
        <div aria-hidden className="flex items-end gap-1.5 flex-none">
          {[0, 1, 2].map((k) => <span key={k} className="block w-[30px] h-[45px] rounded-[3px] border border-dashed border-line-strong" />)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink text-[17px] max-w-xl">{sentence}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {f.radius < 25 && <Button type="button" variant="secondary" onClick={widen}>{t.widen}</Button>}
            {n > 0 && <Button type="button" variant="quiet" onClick={reset}>{t.reset}</Button>}
          </div>
        </div>
      </div>

      {q.length >= 2 && !loggedIn && (
        <div className="rounded-[10px] border border-line p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-2 max-w-lg">{t.guest}</p>
          <LinkButton href={`/anmelden?next=${encodeURIComponent(`/suche?q=${q}`)}`} variant="secondary">{t.login}</LinkButton>
        </div>
      )}

      {q.length >= 2 && loggedIn && works && (
        works.length === 0 ? (
          <p className="text-muted text-sm px-1">{t.notInCatalog(q)}</p>
        ) : (
          <div className="rounded-[10px] border border-line">
            <p className="px-5 md:px-6 pt-5 pb-3 text-[14px] text-muted">{t.wishIntro}</p>
            <ul className="divide-y divide-line border-t border-line">
              {works.map((w) => (
                <li key={w.work_id} className="flex items-center justify-between gap-4 px-5 md:px-6 py-3.5">
                  <div className="min-w-0">
                    <div className="font-serif text-[18px] leading-tight truncate">{w.title}</div>
                    {w.authors.length > 0 && <div className="text-sm text-muted truncate">{w.authors.join(", ")}</div>}
                  </div>
                  {added.has(w.work_id) ? (
                    <Link href="/wunschliste" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok hover:underline underline-offset-4"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" /> {t.onList}</Link>
                  ) : (
                    <Button type="button" variant={works.length === 1 ? "primary" : "secondary"} size="sm" disabled={busy === w.work_id} onClick={() => wish(w.work_id)}>
                      {t.addWish}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
