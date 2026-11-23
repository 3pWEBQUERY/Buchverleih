"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { IMPORT } from "@/lib/i18n/messages/import";
import { useLocale } from "@/components/locale-provider";
import { StepSection } from "@/components/step-section";
import { Button, LinkButton, Notice, Segmented, Select, cx } from "@/components/ui";
import { IconArrowRight, IconBookmark, IconCheck, IconShelf } from "@/components/icons";
import type { ImportRow } from "@/lib/import";

type Target = "shelf" | "wish" | "skip";
type Row = ImportRow & { suggested: Target; target: Target };
type Outcome = "added" | "wished" | "duplicate" | "failed";
const PAGE = 100;
const CHUNK = 5;

export function ImportClient({ wishlist, swap }: { wishlist: boolean; swap: boolean }) {
  const l = useLocale();
  const t = IMPORT[l];
  const L = labels(l);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"goodreads" | "storygraph" | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | Target>("all");
  const [shown, setShown] = useState(PAGE);
  const [condition, setCondition] = useState(2);
  const [offers, setOffers] = useState<("lend" | "swap" | "gift")[]>(["lend"]);
  const [visibility, setVisibility] = useState<"all" | "proven" | "circles">("all");
  const [run, setRun] = useState<{ done: number; total: number; stopped?: boolean; finished?: boolean } | null>(null);
  const [results, setResults] = useState<Record<string, { outcome: Outcome; error?: string }>>({});
  const stop = useRef(false);

  async function read(file: File) {
    setError(null);
    setReading(true);
    try {
      const res = await fetch("/api/v1/import/parse", { method: "POST", headers: { "content-type": "text/csv" }, body: await file.text(), credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? t.error);
      const fix = (s: Target): Target => (s === "wish" && !wishlist ? "skip" : s);
      setRows((data.rows as (ImportRow & { suggested: Target })[]).map((r) => ({ ...r, suggested: fix(r.suggested), target: fix(r.suggested) })));
      setFormat(data.format);
      setFilter("all");
      setShown(PAGE);
      setResults({});
      setRun(null);
    } catch (e) {
      setError((e as Error).message || t.error);
    } finally {
      setReading(false);
    }
  }

  const count = useMemo(() => ({
    all: rows.length,
    shelf: rows.filter((r) => r.target === "shelf").length,
    wish: rows.filter((r) => r.target === "wish").length,
    skip: rows.filter((r) => r.target === "skip").length,
  }), [rows]);
  const visible = rows.filter((r) => filter === "all" || r.target === filter);
  const setTarget = (key: string, target: Target) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, target } : r)));
  const bulk = (fn: (r: Row) => Target | null) => setRows((rs) => rs.map((r) => { const x = fn(r); return x ? { ...r, target: x } : r; }));

  async function start() {
    const todo = rows.filter((r) => r.target !== "skip" && !results[r.key]);
    if (!todo.length) return;
    stop.current = false;
    setRun({ done: 0, total: todo.length });
    let done = 0;
    for (let i = 0; i < todo.length; i += CHUNK) {
      if (stop.current) { setRun({ done, total: todo.length, stopped: true }); return; }
      const part = todo.slice(i, i + CHUNK);
      try {
        const r = await api<{ results: { key: string; outcome: Outcome; error?: string }[] }>("/import/rows", {
          // «suggested» verwirft der Server (unbekannte Felder werden ignoriert)
          body: { rows: part, settings: { condition, offers, visibility } },
        });
        setResults((m) => ({ ...m, ...Object.fromEntries(r.results.map((x) => [x.key, { outcome: x.outcome, error: x.error }])) }));
      } catch (e) {
        setResults((m) => ({ ...m, ...Object.fromEntries(part.map((x) => [x.key, { outcome: "failed" as const, error: (e as Error).message }])) }));
        // Kontingent oder Abmeldung: nicht weiter anfragen
        if ((e as { status?: number }).status === 429 || (e as { status?: number }).status === 401) { setRun({ done, total: todo.length, stopped: true }); return; }
      }
      done += part.length;
      setRun({ done, total: todo.length });
    }
    setRun({ done, total: todo.length, finished: true });
  }

  const tally = Object.values(results).reduce((a, r) => ({ ...a, [r.outcome]: (a[r.outcome] ?? 0) + 1 }), {} as Partial<Record<Outcome, number>>);
  const failed = rows.filter((r) => results[r.key]?.outcome === "failed");
  const running = run && !run.finished && !run.stopped;
  let n = 0;

  return (
    <div>
      <header className="anim-rise">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="display text-display mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h1>
        <p className="text-body-lg text-ink-2 mt-3 leading-relaxed max-w-2xl">{t.lead}</p>
      </header>

      <div className="mt-10 md:mt-12 max-w-4xl">
        <StepSection n={++n} first title={t.step1[0]} desc={t.step1[1]}>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {(["goodreads", "storygraph"] as const).map((k) => (
              <div key={k} className={cx("rounded-md border p-4", format === k ? "border-accent bg-accent-soft/30" : "border-line")}>
                <p className="font-medium text-body flex items-center gap-2">{t.how[k][0]}{format === k && <IconCheck width={16} height={16} className="text-accent-hover" />}</p>
                <p className="text-meta text-muted mt-1 leading-snug">{t.how[k][1]}</p>
              </div>
            ))}
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
            className={cx("rounded-md border-2 border-dashed p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-center gap-3 text-center transition-colors",
              drag ? "border-accent bg-accent-soft/30" : "border-line-strong")}>
            <span className="text-ink-2">{reading ? t.reading : t.drop}</span>
            {!reading && <span className="text-muted text-body-sm">{t.or}</span>}
            <Button type="button" variant={rows.length ? "secondary" : "primary"} disabled={reading || Boolean(running)} onClick={() => fileInput.current?.click()}>
              {rows.length ? t.other : t.choose}
            </Button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
          </div>
          {error && <p role="alert" className="mt-3 text-late text-body-sm">{error}</p>}
        </StepSection>

        {rows.length > 0 && format && (
          <>
            <StepSection n={++n} title={t.step2[0]} desc={t.step2[1]} aside={t.found(rows.length, t.how[format][0])}>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant="secondary" onClick={() => bulk((r) => (r.status === "read" ? "shelf" : null))}>{t.bulkRead}</Button>
                {wishlist && <Button size="sm" variant="secondary" onClick={() => bulk((r) => (r.status === "to-read" ? "wish" : null))}>{t.bulkToRead}</Button>}
                <Button size="sm" variant="ghost" onClick={() => bulk(() => "skip")}>{t.bulkNone}</Button>
              </div>
              <nav aria-label={t.step2[0]} className="border-b border-line mb-2">
                <ul className="flex gap-6 overflow-x-auto scroll-x-fade" style={{ scrollbarWidth: "none" }}>
                  {(["all", "shelf", "wish", "skip"] as const).filter((f) => f !== "wish" || wishlist).map((f) => (
                    <li key={f}>
                      <button type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setShown(PAGE); }}
                        className={cx("relative inline-flex items-center gap-2 h-11 text-body-sm font-medium whitespace-nowrap", filter === f ? "text-ink" : "text-muted hover:text-ink")}>
                        {t.filter[f]} <span className="text-caption tnum text-muted">{count[f]}</span>
                        {filter === f && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <ul className="divide-y divide-line">
                {visible.slice(0, shown).map((r) => {
                  const res = results[r.key];
                  return (
                    <li key={r.key} className="py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-center">
                      <div className="min-w-0">
                        <p className="font-serif text-lead leading-tight truncate">{r.title}</p>
                        <p className="text-meta text-muted truncate mt-0.5">
                          {[r.authors.join(", "), t.status[r.status], r.owned ? t.owned : null, r.isbn13 ? null : t.noIsbn].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {res ? (
                        <span className={cx("chip", res.outcome === "failed" ? "text-late" : res.outcome === "duplicate" ? "text-muted" : "text-ok")}>
                          {res.outcome === "added" ? <IconShelf width={14} height={14} /> : res.outcome === "wished" ? <IconBookmark width={14} height={14} /> : null}
                          {t.result[res.outcome]}
                        </span>
                      ) : (
                        <Segmented name={t.targetAria(r.title)} value={r.target} className="w-[13.5rem] sm:w-60"
                          options={(["shelf", "wish", "skip"] as const).filter((x) => x !== "wish" || wishlist).map((x) => ({ value: x, label: t.target[x] }))}
                          onChange={(v) => setTarget(r.key, v)} />
                      )}
                    </li>
                  );
                })}
              </ul>
              {visible.length > shown && (
                <Button variant="quiet" className="mt-2" onClick={() => setShown((s) => s + PAGE)}>{t.more(Math.min(PAGE, visible.length - shown))}</Button>
              )}
            </StepSection>

            {count.shelf > 0 && (
              <StepSection n={++n} title={t.step3[0]} desc={t.step3[1]}>
                <div className="grid gap-6 max-w-2xl">
                  <div>
                    <p className="text-meta font-semibold mb-2">{t.condition}</p>
                    <Segmented name={t.condition} value={condition} size="lg" onChange={setCondition}
                      options={[1, 2, 3, 4].map((c) => ({ value: c, label: L.conditionLabel[c] }))} />
                  </div>
                  <div>
                    <p className="text-meta font-semibold mb-2">{t.offers}</p>
                    <div className="flex flex-wrap gap-2">
                      {(["lend", "swap", "gift"] as const).filter((o) => o === "lend" || swap).map((o) => {
                        const on = offers.includes(o);
                        return (
                          <button key={o} type="button" aria-pressed={on}
                            onClick={() => setOffers((xs) => (on ? (xs.length > 1 ? xs.filter((x) => x !== o) : xs) : [...xs, o]))}
                            className={cx("h-11 px-4 rounded-sm border text-body-sm font-medium inline-flex items-center gap-2 transition-colors",
                              on ? "border-accent bg-accent-soft/40 text-accent-hover" : "border-line text-ink-2 hover:border-ink-2")}>
                            {on && <IconCheck width={15} height={15} />}{L.offerLabel[o]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="max-w-sm">
                    <p className="text-meta font-semibold mb-2">{t.visibility}</p>
                    <Select value={visibility} onChange={setVisibility} aria-label={t.visibility}
                      options={(["all", "proven", "circles"] as const).map((v) => ({ value: v, label: L.visibilityLabel[v] }))} />
                  </div>
                </div>
              </StepSection>
            )}

            <StepSection n={++n} title={t.step4[0]} desc={t.step4[1]}>
              {!run?.finished && (
                count.shelf + count.wish === 0 ? <p className="text-muted">{t.nothing}</p> : (
                  <div className="flex flex-wrap items-center gap-3">
                    {running ? (
                      <Button variant="ghost" onClick={() => { stop.current = true; }}>{t.stop}</Button>
                    ) : (
                      <Button variant="primary" size="lg" onClick={start}>
                        {t.start(count.shelf - Object.entries(results).filter(([k]) => rows.find((r) => r.key === k)?.target === "shelf").length,
                          count.wish - Object.entries(results).filter(([k]) => rows.find((r) => r.key === k)?.target === "wish").length)}
                        <IconArrowRight width={18} height={18} />
                      </Button>
                    )}
                  </div>
                )
              )}
              {run && (
                <div className="mt-5" aria-live="polite">
                  <div className="h-2 rounded-full bg-paper-2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.done}>
                    <div className="h-full bg-accent transition-[width] duration-base" style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-body-sm text-ink-2 mt-2">{run.finished ? t.done : run.stopped ? t.stopped : t.running(run.done, run.total)}</p>
                  {(run.finished || run.stopped) && (
                    <>
                      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["added", "wished", "duplicate", "failed"] as const).map((k) => (
                          <div key={k} className="rounded-md border border-line px-4 py-3 flex flex-col-reverse">
                            <dt className="text-meta text-muted">{t.result[k]}</dt>
                            <dd className="text-title font-title tnum leading-none">{tally[k] ?? 0}</dd>
                          </div>
                        ))}
                      </dl>
                      {failed.length > 0 && (
                        <Notice tone="late" className="mt-4">
                          <p className="font-medium">{t.failedList}</p>
                          <ul className="mt-1 text-body-sm">
                            {failed.slice(0, 20).map((r) => <li key={r.key}>{r.title}{results[r.key]?.error ? ` – ${results[r.key]?.error}` : ""}</li>)}
                          </ul>
                        </Notice>
                      )}
                      <div className="mt-5 flex flex-wrap gap-3">
                        {(tally.added ?? 0) > 0 && <LinkButton href="/regal" variant="primary">{t.toShelf}</LinkButton>}
                        {(tally.wished ?? 0) > 0 && <LinkButton href="/wunschliste" variant="secondary">{t.toWishlist}</LinkButton>}
                        <Button variant="quiet" onClick={() => { setRows([]); setFormat(null); setRun(null); setResults({}); }}>{t.again}</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </StepSection>
          </>
        )}
      </div>
    </div>
  );
}

/** Verweis von «Buch erfassen» und vom Regal */
export function ImportLink({ className }: { className?: string }) {
  const t = IMPORT[useLocale()];
  return (
    <Link href="/regal/import" className={cx("inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-hover hover:underline underline-offset-4", className)}>
      {t.link} <IconArrowRight width={14} height={14} />
    </Link>
  );
}
