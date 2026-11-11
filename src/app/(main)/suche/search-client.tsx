"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cover, coverRatio } from "@/components/cover";
import { Spine } from "@/components/spine";
import { useToast } from "@/components/toast";
import { IconSearch, IconClose, IconArrowRight } from "@/components/icons";
import { Button, LinkButton, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { fmtDistance } from "@/lib/geo";
import { genres, languageLabel, offerLabel, conditionLabel } from "@/lib/i18n/de-CH";
import type { WorkHit } from "@/lib/search";

export type Filters = {
  radius: number;
  offer: "" | "lend" | "swap" | "gift";
  available: boolean;
  language: string;
  genre: string;
  condition: number;
};

const DEFAULTS: Filters = { radius: 10, offer: "", available: false, language: "", genre: "", condition: 0 };
const RADII = [1, 2, 5, 10, 25];

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

export function availabilityText(h: Pick<WorkHit, "copies" | "available_now">) {
  if (h.copies === 1) return h.available_now ? "1 Exemplar, jetzt frei" : "1 Exemplar, gerade vergeben";
  return h.available_now
    ? `${h.copies} Exemplare, ${h.available_now} jetzt frei`
    : `${h.copies} Exemplare, keines jetzt frei`;
}

/** Kurzform für den Chip auf der Karte */
function availabilityChip(h: Pick<WorkHit, "copies" | "available_now">) {
  if (h.copies === 1) return h.available_now ? "Jetzt frei" : "Gerade vergeben";
  return h.available_now ? `${h.available_now} von ${h.copies} jetzt frei` : `${h.copies} Exemplare, alle vergeben`;
}

const coverOf = (h: WorkHit) => ({
  title: h.title, authors: h.authors, photoKey: h.cover?.photo_key, photoW: h.cover?.photo_w, photoH: h.cover?.photo_h, coverKey: h.cover?.cover_key, seed: h.work_id,
});

export function SearchClient({
  loggedIn, autoFocus, initialQ, initialPlz, initialPlace, initialFilters, initialResults,
}: {
  loggedIn: boolean;
  autoFocus: boolean;
  initialQ: string;
  initialPlz: string;
  initialPlace: string | null;
  initialFilters: Filters;
  initialResults: WorkHit[] | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [f, setF] = useState<Filters>(initialFilters);
  const [plz, setPlz] = useState(initialPlz);
  const [place, setPlace] = useState<string | null>(initialPlace);
  const [results, setResults] = useState<WorkHit[] | null>(initialResults);
  const [resultsFor, setResultsFor] = useState(initialQ.trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const target = key ? `/suche?${key}` : "/suche";
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
        const data = (await r.json()) as { results: WorkHit[] };
        setResults(data.results);
        setResultsFor(q.trim());
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Die Suche hat gerade nicht geantwortet. Prüfe die Verbindung und tippe erneut.");
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

  const where = place ? ` um ${place}` : "";
  const summary = results
    ? resultsFor
      ? `${results.length === 0 ? "Keine Treffer" : results.length === 1 ? "1 Titel" : `${results.length} Titel`}${hasOrigin ? ` im Umkreis von ${f.radius} km${where}` : ""}`
      : `${results.length === 1 ? "1 Titel" : `${results.length} Titel`} im Umkreis von ${f.radius} km${where}`
    : null;

  // Ohne Suchbegriff: die nächsten freien Titel als Regal auf der dunklen Bühne, der Rest als Karten
  const browsing = !!results && !resultsFor;
  const stage = browsing && results.length >= 6 ? results.filter((h) => h.available_now > 0).slice(0, 12) : [];
  const onStage = new Set(stage.map((h) => h.work_id));
  const rest = results ? results.filter((h) => !onStage.has(h.work_id)) : [];

  return (
    <div>
      <header className="mb-8 md:mb-10 anim-rise">
        <p className="eyebrow">{place ? `Suche · rund um ${place}` : "Suche"}</p>
        <h1 className="display text-[52px] md:text-[84px] mt-3">Was liest du <em>als Nächstes?</em></h1>
      </header>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative anim-rise" style={{ animationDelay: "40ms" }}>
        <label htmlFor="suche-q" className="sr-only">Titel, Autorin oder ISBN</label>
        <span aria-hidden className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none">
          <IconSearch width={22} height={22} />
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
          placeholder="Titel, Autorin oder ISBN"
          className="w-full h-16 md:h-[72px] bg-paper border border-line-strong rounded-full pl-14 md:pl-16 pr-14 text-[18px] md:text-[21px] tracking-[-0.01em] placeholder:text-muted/80 hover:border-ink-2 focus:outline-none focus:border-ink focus:ring-[4px] focus:ring-ink/10 transition-[border-color,box-shadow] duration-150 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Suchbegriff löschen"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-full text-ink-2 hover:bg-paper-2 hover:text-ink transition-colors">
            <IconClose />
          </button>
        ) : (
          <kbd aria-hidden className="hidden md:grid absolute right-6 top-1/2 -translate-y-1/2 h-7 w-7 place-items-center text-[13px] text-muted border border-line-strong rounded-[7px] font-sans">/</kbd>
        )}
      </form>

      {!loggedIn && (
        <PlzBar plz={plz} place={place} onSet={(p, name) => { setPlz(p); setPlace(name); }} />
      )}

      <FilterChips f={f} set={set} reset={() => setF(DEFAULTS)} n={n} hasOrigin={hasOrigin} />

      <section aria-labelledby="treffer" className="mt-10 md:mt-12 min-w-0">
        <div className={cx("flex items-baseline justify-between gap-4 mb-5", !summary && "sr-only")}>
          <h2 id="treffer" className="ui-title text-[17px] md:text-[19px]" aria-live="polite">{summary ?? " "}</h2>
          <span className={cx("text-[13px] text-muted transition-opacity", loading ? "opacity-100" : "opacity-0")} aria-hidden>sucht …</span>
        </div>

        {error && <p role="alert" className="panel-quiet text-late px-5 py-4 mb-5">{error}</p>}

        {results === null && loading && <ResultSkeleton />}

        {stage.length > 0 && <Stage hits={stage} href={href} radius={f.radius} />}

        {results && rest.length > 0 && (
          <>
            {stage.length > 0 && (
              <h3 className="ui-title text-[22px] md:text-[26px] mt-14 md:mt-16 mb-6">Alles im Umkreis</h3>
            )}
            <ul className={cx("grid md:grid-cols-2 gap-3 transition-opacity duration-150", loading && "opacity-60")}>
              {rest.map((h, i) => (
                <ResultCard key={h.work_id} h={h} href={href(h)} i={i} />
              ))}
            </ul>
          </>
        )}

        {results && results.length === 0 && !loading && (
          <NoHits q={resultsFor} f={f} n={n} loggedIn={loggedIn}
            widen={() => set("radius", 25)} reset={() => setF({ ...DEFAULTS, radius: f.radius })} />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Filter */

const chip = "h-10 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-2 whitespace-nowrap flex-none border transition-[background-color,color,border-color] duration-200";
const chipOff = "border-line-strong text-ink-2 hover:border-ink hover:text-ink";
const chipOn = "bg-ink border-ink text-paper";

function FilterChips({ f, set, reset, n, hasOrigin }: { f: Filters; set: <K extends keyof Filters>(k: K, v: Filters[K]) => void; reset: () => void; n: number; hasOrigin: boolean }) {
  return (
    <div className="mt-5 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible anim-rise [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ animationDelay: "80ms" }}>
      <div role="group" aria-label="Filter" className="flex md:flex-wrap items-center gap-2 w-max md:w-auto pb-1">
        <div role="radiogroup" aria-label="Umkreis in Kilometern"
          className={cx("flex-none inline-flex items-center h-10 pl-4 pr-1 gap-0.5 rounded-full bg-paper-2", !hasOrigin && "opacity-50 pointer-events-none")}>
          <span className="text-[13px] font-medium text-muted mr-1.5">Umkreis</span>
          {RADII.map((r) => {
            const on = f.radius === r;
            return (
              <button key={r} type="button" role="radio" aria-checked={on} onClick={() => set("radius", r)}
                className={cx("h-8 min-w-8 px-2.5 rounded-full text-[13.5px] font-semibold tnum transition-colors duration-200", on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3")}>
                {r}{on && <span className="font-medium"> km</span>}
              </button>
            );
          })}
        </div>

        <button type="button" aria-pressed={f.available} onClick={() => set("available", !f.available)} className={cx(chip, f.available ? chipOn : chipOff)}>
          <span aria-hidden className={cx("h-2 w-2 rounded-full", f.available ? "bg-paper" : "bg-ok")} /> Jetzt frei
        </button>

        <span aria-hidden className="h-6 w-px bg-line-strong mx-1 flex-none" />

        {(["lend", "swap", "gift"] as const).map((o) => {
          const on = f.offer === o;
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => set("offer", on ? "" : o)} className={cx(chip, on ? chipOn : chipOff)}>
              {offerLabel[o]}
            </button>
          );
        })}

        <span aria-hidden className="h-6 w-px bg-line-strong mx-1 flex-none" />

        <PillSelect label="Sprache" value={f.language} onChange={(v) => set("language", v)}
          options={[["", "Alle Sprachen"], ...Object.entries(languageLabel)]} />
        <PillSelect label="Genre" value={f.genre} onChange={(v) => set("genre", v)}
          options={[["", "Alle Genres"], ...genres.map((g) => [g, g] as [string, string])]} />
        <PillSelect label="Zustand" value={String(f.condition)} onChange={(v) => set("condition", Number(v))}
          options={[["0", "Jeder Zustand"], ["1", conditionLabel[1]], ["2", `${conditionLabel[2]} oder besser`], ["3", `${conditionLabel[3]} oder besser`]]} />

        {n > 0 && (
          <button type="button" onClick={reset} className="h-10 px-3 text-[14px] font-medium text-muted hover:text-ink underline-offset-4 hover:underline flex-none">
            Zurücksetzen
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
        className={cx(chip, on ? chipOn : chipOff, "appearance-none [field-sizing:content] pr-9 cursor-pointer focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ink/20 [&>option]:bg-paper [&>option]:text-ink [&>option]:font-normal")}>
        {options.map(([v, l]) => <option key={v} value={v}>{v === "" || v === "0" ? label : l}</option>)}
      </select>
      <svg aria-hidden viewBox="0 0 12 8" className={cx("absolute right-3.5 top-1/2 -translate-y-1/2 w-2.5 pointer-events-none", on ? "text-paper" : "text-muted")} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M1 1.5l5 5 5-5" />
      </svg>
    </label>
  );
}

/* ---------------------------------------------------------------- Treffer */

function Stage({ hits, href, radius }: { hits: WorkHit[]; href: (h: WorkHit) => string; radius: number }) {
  return (
    <div className="surface-night rounded-[22px] px-5 md:px-9 pt-7 md:pt-9 pb-7 md:pb-8 -mx-1 md:mx-0 anim-rise">
      <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-night-muted">Jetzt frei · bis {radius} km</p>
          <h3 className="font-serif text-[36px] md:text-[48px] leading-none mt-2">Gleich um die Ecke</h3>
        </div>
      </div>
      <ul className="shelf" aria-label="Jetzt frei in deiner Nähe">
        {hits.map((h, i) => {
          const cover = coverOf(h);
          const w = Math.max(104, Math.round(176 * coverRatio(cover)));
          return (
            <li key={h.work_id} style={{ width: w, animationDelay: `${Math.min(i, 10) * 30}ms` }} className="anim-rise">
              <Link href={href(h)} className="book block group">
                <div className="flex items-end" style={{ height: 196 }}>
                  <div className="book-face"><Cover data={cover} height={156 + ((i * 7) % 4) * 8} /></div>
                </div>
                <div className="h-[3px] bg-night-ink/90 rounded-full" />
                <p className="pt-2.5 text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline">{h.title}</p>
                <p className="text-[12px] text-night-muted mt-1 flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#8fd09a]" />
                  frei{h.nearest_m != null && <> · {fmtDistance(h.nearest_m)}</>}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultCard({ h, href, i }: { h: WorkHit; href: string; i: number }) {
  const dist = fmtDistance(h.nearest_m);
  return (
    <li className="anim-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <Link href={href} className="book group panel h-full flex gap-4 md:gap-5 p-4 md:p-5 hover:border-ink transition-colors duration-200">
        <div className="flex-none self-start pt-0.5">
          <div className="book-face"><Cover data={coverOf(h)} width={76} /></div>
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-[22px] md:text-[25px] leading-[1.05] line-clamp-2">{h.title}</p>
            {dist && <span className="flex-none text-[13.5px] font-semibold tnum text-ink-2 pt-1">{dist}</span>}
          </div>
          {h.authors.length > 0 && <p className="text-[14px] text-muted mt-1 truncate">{h.authors.join(", ")}</p>}
          <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="chip">
              <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", h.available_now ? "bg-ok" : "bg-lent")} />
              <span className="sr-only">{availabilityText(h)}</span>
              <span aria-hidden>{availabilityChip(h)}</span>
            </span>
            {h.offers.length > 0 && <span className="text-[13px] text-muted">{h.offers.map((o) => offerLabel[o]).join(" · ")}</span>}
            <IconArrowRight aria-hidden width={16} height={16} className="ml-auto text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-200" />
          </div>
        </div>
      </Link>
    </li>
  );
}

function ResultSkeleton() {
  return (
    <ul aria-hidden className="grid md:grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="panel flex gap-5 p-5">
          <div className="skeleton w-[76px] h-[112px] flex-none" />
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
  const [editing, setEditing] = useState(!plz);
  const [value, setValue] = useState(plz);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(value)) return setErr("Gib vier Ziffern ein, z. B. 8180.");
    try {
      const r = await fetch(`/api/v1/regions/plz/${value}`);
      const d = (await r.json()) as { known: boolean; municipality?: string };
      if (!d.known) return setErr("Diese Postleitzahl kennen wir nicht. Prüfe die vier Ziffern.");
      setErr(null);
      setEditing(false);
      onSet(value, d.municipality ?? null);
    } catch {
      setErr("Keine Verbindung. Versuche es erneut.");
    }
  }

  if (!editing && plz) {
    return (
      <p className="mt-4 text-[14px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" /> <span className="tnum">{plz}</span>{place && <> {place}</>}</span>
        <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => setEditing(true)}>Ändern</button>
        <Link href="/anmelden?next=/suche" className="underline underline-offset-4 hover:text-ink">Anmelden und anfragen</Link>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="mt-5 panel-quiet rounded-[18px] p-5 md:p-6 flex flex-wrap items-end justify-between gap-4">
      <label htmlFor="suche-plz" className="block text-[15px] text-ink-2 max-w-md">Deine Postleitzahl, damit wir zeigen können, was in der Nähe steht.</label>
      <div className="flex items-center gap-2">
        <input id="suche-plz" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="8180" value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} aria-describedby={err ? "suche-plz-err" : undefined}
          className="w-28 h-11 bg-paper border border-line-strong rounded-full px-5 text-[16px] tnum tracking-[0.08em] placeholder:text-muted/70 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-ink/10" />
        <Button type="submit" disabled={value.length !== 4}>Bestand zeigen</Button>
      </div>
      {err && <span id="suche-plz-err" role="alert" className="basis-full block text-sm text-late">{err}</span>}
    </form>
  );
}

/* ----------------------------------------------------------- Keine Treffer */

type CatalogEdition = { id: string; work_id: string; title: string; authors: string[] };

function NoHits({ q, f, n, loggedIn, widen, reset }: { q: string; f: Filters; n: number; loggedIn: boolean; widen: () => void; reset: () => void }) {
  const toast = useToast();
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
      toast.show({ text: "Auf der Wunschliste. Der Titelalarm ist an." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const sentence = q
    ? `Für «${q}» steht im Umkreis von ${f.radius} km gerade nichts im Regal.`
    : `Im Umkreis von ${f.radius} km steht gerade nichts im Regal.`;

  return (
    <div className="anim-rise space-y-4">
      <div className="panel-quiet rounded-[18px] p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6">
        <div aria-hidden className="flex items-end gap-[3px] flex-none">
          <Spine title="Leer" height={78} />
          <Spine title="Regal" height={70} />
          <span className="h-[54px] w-[30px] rounded-[3px] border border-dashed border-line-strong" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink text-[17px] max-w-xl">{sentence}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {f.radius < 25 && <Button type="button" variant="secondary" onClick={widen}>Im Umkreis von 25 km suchen</Button>}
            {n > 0 && <Button type="button" variant="quiet" onClick={reset}>Filter zurücksetzen</Button>}
          </div>
        </div>
      </div>

      {q.length >= 2 && !loggedIn && (
        <div className="panel p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-2 max-w-lg">Mit der Wunschliste melden wir uns, sobald der Titel in deiner Nähe frei wird.</p>
          <LinkButton href={`/anmelden?next=${encodeURIComponent(`/suche?q=${q}`)}`} variant="ghost">Anmelden</LinkButton>
        </div>
      )}

      {q.length >= 2 && loggedIn && works && (
        works.length === 0 ? (
          <p className="text-muted text-sm px-1">Auch im Katalog finden wir «{q}» nicht. Prüfe die Schreibweise oder suche nach der ISBN.</p>
        ) : (
          <div className="panel">
            <p className="px-5 md:px-6 pt-5 pb-3 text-[14px] text-muted">Setz den Titel auf die Wunschliste. Wir melden uns, sobald ein Exemplar in der Nähe frei wird.</p>
            <ul className="divide-y divide-line border-t border-line">
              {works.map((w) => (
                <li key={w.work_id} className="flex items-center justify-between gap-4 px-5 md:px-6 py-3.5">
                  <div className="min-w-0">
                    <div className="font-serif text-[20px] leading-tight truncate">{w.title}</div>
                    {w.authors.length > 0 && <div className="text-sm text-muted truncate">{w.authors.join(", ")}</div>}
                  </div>
                  {added.has(w.work_id) ? (
                    <Link href="/wunschliste" className="chip hover:bg-paper-3"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" /> Auf der Wunschliste</Link>
                  ) : (
                    <Button type="button" variant={works.length === 1 ? "primary" : "secondary"} size="sm" disabled={busy === w.work_id} onClick={() => wish(w.work_id)}>
                      Auf die Wunschliste
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
