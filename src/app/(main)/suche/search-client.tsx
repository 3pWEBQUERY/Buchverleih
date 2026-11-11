"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { StatusText } from "@/components/status";
import { useToast } from "@/components/toast";
import { IconSearch, IconClose } from "@/components/icons";
import { Button, Input, LinkButton, Segmented, Select, Switch, cx } from "@/components/ui";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      : `Bestand im Umkreis von ${f.radius} km${where}`
    : null;

  return (
    <div>
      <header className="mb-6 md:mb-8">
        <h1 className="display text-4xl md:text-6xl">Suchen</h1>
      </header>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="suche-q" className="sr-only">Titel, Autorin oder ISBN</label>
        <span aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><IconSearch /></span>
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
          className="w-full h-14 bg-transparent border border-line-strong rounded-sm pl-11 pr-12 text-lg placeholder:text-muted/80 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Suchbegriff löschen"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink">
            <IconClose />
          </button>
        ) : (
          <kbd aria-hidden className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted border border-line rounded-xs px-1.5 font-sans">/</kbd>
        )}
      </form>

      {!loggedIn && (
        <PlzBar plz={plz} place={place} onSet={(p, name) => { setPlz(p); setPlace(name); }} />
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_232px] lg:gap-12">
        <section aria-labelledby="treffer" className="min-w-0">
          <div className={cx("flex items-center justify-between gap-4 border-b border-line pb-2 mb-1 min-h-10", !hasOrigin && !results && "hidden")}>
            <h2 id="treffer" className="font-sans text-[15px] text-ink-2" aria-live="polite">
              {summary ?? " "}
            </h2>
            <Button type="button" variant="ghost" size="sm" className="lg:hidden -mr-2" aria-expanded={filtersOpen} aria-controls="suche-filter"
              onClick={() => setFiltersOpen((o) => !o)}>
              Filter{n > 0 && <span className="tnum text-muted">{n}</span>}
            </Button>
          </div>

          <div id="suche-filter" className={cx("lg:hidden", filtersOpen ? "block anim-rise" : "hidden")}>
            <FilterPanel f={f} set={set} reset={() => setF(DEFAULTS)} n={n} hasOrigin={hasOrigin} />
          </div>

          {error && <p role="alert" className="text-late py-4">{error}</p>}

          {results === null && loading && <ResultSkeleton />}

          {results && results.length > 0 && (
            <ul className={cx("divide-y divide-line border-b border-line transition-opacity duration-150", loading && "opacity-60")}>
              {results.map((h) => (
                <ResultRow key={h.work_id} h={h} href={href(h)} />
              ))}
            </ul>
          )}

          {results && results.length === 0 && !loading && (
            <NoHits q={resultsFor} f={f} n={n} loggedIn={loggedIn}
              widen={() => set("radius", 25)} reset={() => setF({ ...DEFAULTS, radius: f.radius })} />
          )}
        </section>

        <aside aria-label="Filter" className="hidden lg:block">
          <div className="sticky top-12">
            <FilterPanel f={f} set={set} reset={() => setF(DEFAULTS)} n={n} hasOrigin={hasOrigin} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResultRow({ h, href }: { h: WorkHit; href: string }) {
  const dist = fmtDistance(h.nearest_m);
  return (
    <li>
      <Link href={href} className="group grid grid-cols-[48px_minmax(0,1fr)_auto] gap-4 items-center py-3.5">
        <Cover
          data={{ title: h.title, authors: h.authors, photoKey: h.cover?.photo_key, photoW: h.cover?.photo_w, photoH: h.cover?.photo_h, coverKey: h.cover?.cover_key, seed: h.work_id }}
          width={48}
        />
        <div className="min-w-0">
          <div className="font-serif text-lg md:text-xl leading-tight line-clamp-2 group-hover:underline">{h.title}</div>
          {h.authors.length > 0 && <div className="text-sm text-muted mt-0.5 truncate">{h.authors.join(", ")}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusText tone={h.available_now ? "ok" : "lent"}>{availabilityText(h)}</StatusText>
            {h.offers.length > 0 && <span className="text-[13px] text-muted">{h.offers.map((o) => offerLabel[o]).join(" · ")}</span>}
          </div>
        </div>
        <div className="text-right text-[15px] text-ink-2 self-start pt-1 whitespace-nowrap">{dist}</div>
      </Link>
    </li>
  );
}

function ResultSkeleton() {
  return (
    <ul aria-hidden className="divide-y divide-line border-b border-line">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid grid-cols-[48px_1fr_auto] gap-4 items-center py-3.5">
          <div className="skeleton w-12 h-[72px]" />
          <div>
            <div className="skeleton h-5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <div className="skeleton h-3.5 w-1/3 mt-2" />
            <div className="skeleton h-3 w-2/5 mt-2.5" />
          </div>
          <div className="skeleton h-4 w-12 self-start mt-1" />
        </li>
      ))}
    </ul>
  );
}

function FilterPanel({ f, set, reset, n, hasOrigin }: { f: Filters; set: <K extends keyof Filters>(k: K, v: Filters[K]) => void; reset: () => void; n: number; hasOrigin: boolean }) {
  return (
    <div className="space-y-5 py-4 lg:py-0 border-b border-line lg:border-0 mb-2 lg:mb-0">
      <div className={cx(!hasOrigin && "opacity-50 pointer-events-none")}>
        <span className="block text-sm font-medium mb-1.5" id="f-radius">Umkreis in km</span>
        <Segmented<number> name="Umkreis in Kilometern" value={f.radius} onChange={(v) => set("radius", v)}
          options={[1, 2, 5, 10, 25].map((r) => ({ value: r, label: <span className="tnum">{r}</span> }))} />
      </div>
      <label className="block">
        <span className="block text-sm font-medium mb-1.5">Angebot</span>
        <Select value={f.offer} onChange={(e) => set("offer", e.target.value as Filters["offer"])}>
          <option value="">Alle Angebote</option>
          <option value="lend">{offerLabel.lend}</option>
          <option value="swap">{offerLabel.swap}</option>
          <option value="gift">{offerLabel.gift}</option>
        </Select>
      </label>
      <div className="border-y border-line">
        <Switch checked={f.available} onChange={(v) => set("available", v)} label="Verfügbar jetzt" hint="Heute frei, nicht verliehen" />
      </div>
      <label className="block">
        <span className="block text-sm font-medium mb-1.5">Sprache</span>
        <Select value={f.language} onChange={(e) => set("language", e.target.value)}>
          <option value="">Alle Sprachen</option>
          {Object.entries(languageLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1.5">Genre</span>
        <Select value={f.genre} onChange={(e) => set("genre", e.target.value)}>
          <option value="">Alle Genres</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1.5">Zustand</span>
        <Select value={String(f.condition)} onChange={(e) => set("condition", Number(e.target.value))}>
          <option value="0">Jeder Zustand</option>
          <option value="1">{conditionLabel[1]}</option>
          <option value="2">{conditionLabel[2]} oder besser</option>
          <option value="3">{conditionLabel[3]} oder besser</option>
        </Select>
      </label>
      {n > 0 && <Button type="button" variant="quiet" onClick={reset} className="text-sm">Filter zurücksetzen</Button>}
    </div>
  );
}

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
      <p className="mt-3 text-sm text-muted">
        In der Nähe von <span className="text-ink tnum">{plz}</span>{place && <> {place}</>}.{" "}
        <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => setEditing(true)}>Ändern</button>
        {" · "}
        <Link href="/anmelden?next=/suche" className="underline underline-offset-4 hover:text-ink">Anmelden und anfragen</Link>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="suche-plz" className="block text-sm text-ink-2 mb-1.5">Deine Postleitzahl, damit wir zeigen können, was in der Nähe steht</label>
      <div className="flex items-center gap-3">
        <div className="w-28 flex-none">
          <Input id="suche-plz" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="8180" value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} className="h-10 tnum" aria-describedby={err ? "suche-plz-err" : undefined} />
        </div>
        <Button type="submit" size="md" disabled={value.length !== 4}>Bestand zeigen</Button>
      </div>
      {err && <span id="suche-plz-err" role="alert" className="block text-sm text-late mt-1.5">{err}</span>}
    </form>
  );
}

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
    <div className="py-8 anim-rise">
      <p className="text-ink-2 text-[17px] max-w-xl">{sentence}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {f.radius < 25 && <Button type="button" variant="secondary" onClick={widen}>Im Umkreis von 25 km suchen</Button>}
        {n > 0 && <Button type="button" variant="quiet" onClick={reset}>Filter zurücksetzen</Button>}
      </div>

      {q.length >= 2 && !loggedIn && (
        <div className="mt-8 border-t border-line pt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-2">Mit der Wunschliste melden wir uns, sobald der Titel in deiner Nähe frei wird.</p>
          <LinkButton href={`/anmelden?next=${encodeURIComponent(`/suche?q=${q}`)}`} variant="secondary">Anmelden</LinkButton>
        </div>
      )}

      {q.length >= 2 && loggedIn && works && (
        <div className="mt-8">
          {works.length === 0 ? (
            <p className="text-muted text-sm border-t border-line pt-5">Auch im Katalog finden wir «{q}» nicht. Prüfe die Schreibweise oder suche nach der ISBN.</p>
          ) : (
            <>
              <p className="text-sm text-muted border-t border-line pt-5 mb-1">Setz den Titel auf die Wunschliste. Wir melden uns, sobald ein Exemplar in der Nähe frei wird.</p>
              <ul className="divide-y divide-line">
                {works.map((w) => (
                  <li key={w.work_id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="font-serif text-lg leading-tight truncate">{w.title}</div>
                      {w.authors.length > 0 && <div className="text-sm text-muted truncate">{w.authors.join(", ")}</div>}
                    </div>
                    {added.has(w.work_id) ? (
                      <Link href="/wunschliste" className="text-sm text-ok whitespace-nowrap hover:underline">Auf der Wunschliste</Link>
                    ) : (
                      <Button type="button" variant={works.length === 1 ? "primary" : "secondary"} size="sm" disabled={busy === w.work_id} onClick={() => wish(w.work_id)}>
                        Auf die Wunschliste
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
