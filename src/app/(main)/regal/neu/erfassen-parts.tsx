"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Edition } from "@/lib/catalog/works";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { CAPTURE } from "@/lib/i18n/messages/capture";
import { Cover, type CoverData } from "@/components/cover";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { OptionCard } from "@/components/form-controls";
import { Button, Field, Input, Notice, Select, cx } from "@/components/ui";
import { IconArrowRight, IconCamera, IconCheck, IconClose, IconSearch } from "@/components/icons";

/** Bausteine von «Buch erfassen»: Treffer mit Zustand, Suche, Erfassen ohne ISBN */

const CONDITIONS = [1, 2, 3, 4] as const;
const isbnLike = (s: string) => /^[\d\s-]{9,17}[\dXx]$/.test(s.trim()) && s.replace(/[^\dXx]/g, "").length >= 10;
export const coverOf = (e: Edition): CoverData => ({ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id });

export function LookupSkeleton({ isbn }: { isbn: string }) {
  const t = CAPTURE[useLocale()];
  return (
    <div className="rounded-[10px] border border-line flex gap-5 p-5" aria-live="polite">
      <div className="skeleton w-[80px] h-[120px] flex-none" />
      <div className="flex-1 pt-1">
        <p className="text-sm text-muted tnum">{t.lookingUp(isbn)}</p>
        <div className="skeleton h-5 w-3/4 mt-3" />
        <div className="skeleton h-4 w-1/2 mt-2" />
      </div>
    </div>
  );
}

/** Nach einem Treffer: Ausgabe prüfen, Zustand antippen, fertig. */
export function PendingCard({ edition, ask, onAsked, onCancel, onDone }: {
  edition: Edition; ask: boolean; onAsked: () => void; onCancel: () => void; onDone: (condition: number, precious: boolean) => Promise<void>;
}) {
  const [condition, setCondition] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const l = useLocale();
  const t = CAPTURE[l];

  async function finish(c: number, precious: boolean) {
    setBusy(true);
    try {
      await onDone(c, precious);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  function pick(c: number) {
    if (ask) setCondition(c);
    else finish(c, false);
  }

  const meta = [edition.publisher, edition.year].filter(Boolean).join(", ");
  return (
    <div className="anim-rise" aria-live="polite">
      <div className="rounded-[10px] border border-line p-4 md:p-5 flex gap-4 md:gap-5">
        <div className="anim-cover flex-none"><Cover data={coverOf(edition)} width={80} height={120} uniform priority l={l} /></div>
        <div className="min-w-0 flex-1 flex flex-col">
          <p className="text-[13px] font-medium text-ok flex items-center gap-1.5"><IconCheck width={15} height={15} strokeWidth={2} /> {t.found}</p>
          <h3 className="font-serif text-[22px] md:text-[26px] leading-[1.1] mt-1.5">{edition.title}</h3>
          <p className="text-[14.5px] text-ink-2 mt-1">{edition.authors.join(", ")}</p>
          <dl className="mt-auto pt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            {meta && <div className="flex gap-1.5"><dt className="text-muted">{t.edition}</dt><dd>{meta}</dd></div>}
            {edition.isbn13 && <div className="flex gap-1.5"><dt className="text-muted">ISBN</dt><dd className="tnum">{edition.isbn13}</dd></div>}
          </dl>
        </div>
        <button type="button" onClick={onCancel} className="self-start h-10 w-10 -mt-1.5 -mr-1.5 grid place-items-center rounded-[6px] text-muted hover:text-ink hover:bg-paper-2 transition-colors flex-none" aria-label={t.other}>
          <IconClose />
        </button>
      </div>

      {condition === null ? (
        <fieldset className="mt-4" disabled={busy}>
          <legend className="sr-only">{t.whichCondition}</legend>
          <ConditionGrid onPick={pick} />
        </fieldset>
      ) : (
        <PreciousQuestion busy={busy} condition={condition} onBack={() => setCondition(null)} onAnswer={(yes) => { onAsked(); finish(condition, yes); }} />
      )}
    </div>
  );
}

/** Vier Karten; die Striche zeigen, wie viele Spuren das Buch hat. Gewählt in der Markenfarbe. */
function ConditionGrid({ onPick, value }: { onPick: (c: number) => void; value?: number | null }) {
  const L = labels(useLocale());
  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      {CONDITIONS.map((c) => {
        const on = value === c;
        return (
          <button key={c} type="button" onClick={() => onPick(c)} aria-pressed={on}
            className={cx(
              "group flex flex-col items-start text-left rounded-[10px] p-4 min-h-[112px] border transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45",
              on ? "border-accent bg-accent-soft/35" : "bg-paper border-line hover:border-accent",
            )}>
            <span aria-hidden className="flex gap-1">
              {[1, 2, 3, 4].map((k) => (
                <span key={k} className={cx("h-1.5 w-4 rounded-full transition-colors", k >= c ? (on ? "bg-accent" : "bg-ink-2 group-hover:bg-accent") : "bg-paper-3")} />
              ))}
            </span>
            <span className="block text-[17px] font-[560] tracking-[-0.02em] leading-tight mt-auto pt-4">{L.conditionLabel[c]}</span>
            <span className="block text-[12.5px] leading-snug mt-1 text-muted">{L.conditionHint[c]}</span>
          </button>
        );
      })}
    </div>
  );
}

function PreciousQuestion({ busy, condition, onBack, onAnswer }: { busy: boolean; condition: number; onBack: () => void; onAnswer: (yes: boolean) => void }) {
  const l = useLocale();
  const t = CAPTURE[l];
  return (
    <div className="mt-4 rounded-[10px] bg-paper-2 p-5 md:p-6 anim-rise">
      <p className="text-[13px] text-muted">
        {t.condition}: <span className="text-ink-2 font-medium">{labels(l).conditionLabel[condition]}</span>{" "}
        <button type="button" onClick={onBack} className="text-accent-hover font-medium hover:underline underline-offset-4 ml-1">{t.change}</button>
      </p>
      <p className="text-[20px] md:text-[24px] font-[560] tracking-[-0.03em] leading-[1.15] mt-2 max-w-xl">{t.precious}</p>
      <p className="text-[14px] text-muted mt-2 max-w-xl">{t.preciousHint}</p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => onAnswer(true)}>{t.yesCircles}</Button>
        <Button size="lg" variant="primary" disabled={busy} onClick={() => onAnswer(false)}>{t.noShelf}</Button>
      </div>
    </div>
  );
}

export function SearchTab({ hidden, onPick, onIsbn, onManual }: {
  hidden: boolean;
  onPick: (e: Edition) => void;
  onIsbn: (q: string) => void;
  onManual: (title: string) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; editions: Edition[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const l = useLocale();
  const t = CAPTURE[l];

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2 || isbnLike(needle)) {
      setRes(null);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api<{ editions: Edition[] }>(`/catalog/search?q=${encodeURIComponent(needle)}`);
        if (alive) setRes({ q: needle, editions: r.editions });
      } catch (e) {
        if (alive) toast.error((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, toast]);

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (isbnLike(q)) onIsbn(q); }} className="relative">
        <IconSearch width={18} height={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder={t.searchPlaceholder} aria-label={t.searchAria} className="!pl-11" />
      </form>

      {isbnLike(q) && (
        <div className="mt-3">
          <Button variant="primary" onClick={() => onIsbn(q)}>{t.lookupIsbn(q.replace(/[^\dXx]/g, ""))}</Button>
        </div>
      )}

      {!hidden && loading && !res && (
        <ul className="mt-4 rounded-[10px] border border-line divide-y divide-line px-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-4 py-3">
              <div className="skeleton w-[40px] h-[60px] flex-none" />
              <div className="flex-1 pt-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3 mt-2" /></div>
            </li>
          ))}
        </ul>
      )}

      {!hidden && res && res.editions.length > 0 && (
        <ul className={cx("mt-4 rounded-[10px] border border-line divide-y divide-line overflow-hidden transition-opacity", loading && "opacity-60")} aria-label={t.editions}>
          {res.editions.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="group w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-paper-2 focus-visible:bg-paper-2 transition-colors">
                <Cover data={coverOf(e)} width={40} height={60} uniform l={l} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[17px] leading-tight">{e.title}</span>
                  <span className="block text-[13px] text-muted truncate mt-0.5">
                    {[e.authors.join(", "), e.publisher, e.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="h-9 px-3.5 rounded-[6px] bg-accent-soft text-accent-hover text-[13.5px] font-medium flex-none hidden sm:inline-flex items-center gap-1.5 group-hover:bg-accent group-hover:text-accent-ink transition-colors">
                  {t.pick} <IconArrowRight width={14} height={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!hidden && res && (
        <div className={cx("flex flex-wrap items-center justify-between gap-4", res.editions.length ? "mt-4" : "mt-4 rounded-[10px] border border-dashed border-line-strong px-5 py-5")}>
          <p className={res.editions.length ? "text-[14px] text-muted" : "text-ink-2 text-[15px]"}>
            {res.editions.length ? t.notThere : t.unknown(res.q)}
          </p>
          <Button size="sm" variant="secondary" onClick={() => onManual(res.q)}>{t.withoutIsbn}</Button>
        </div>
      )}
    </div>
  );
}

export function ManualTab({ prefill, ask, onAsked, add }: {
  prefill: { isbn?: string; title?: string; notFound?: boolean };
  ask: boolean;
  onAsked: () => void;
  add: (e: Edition, condition: number, precious: boolean, photo?: File | null) => Promise<void>;
}) {
  const toast = useToast();
  const l = useLocale();
  const c = CAPTURE[l];
  const t = c.manual;
  const L = labels(l);
  const [title, setTitle] = useState(prefill.title ?? "");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [language, setLanguage] = useState("de");
  const [isbn, setIsbn] = useState(prefill.isbn ?? "");
  const [condition, setCondition] = useState<number>(2);
  const [precious, setPrecious] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => titleRef.current?.focus(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.needTitle);
      titleRef.current?.focus();
      return;
    }
    const y = year.trim() ? Number(year) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1450 || y > 2100)) {
      setError(null);
      toast.error(t.badYear);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ edition: Edition }>("/catalog/editions", {
        body: {
          title: title.trim(),
          authors: authors.split(new RegExp(`[,;]|${t.and}`)).map((a) => a.trim()).filter(Boolean),
          year: y,
          language: language || null,
          isbn: isbn.trim() || null,
        },
      });
      const yes = ask && precious;
      if (ask) onAsked();
      await add(r.edition, condition, yes, photo);
      setTitle("");
      setAuthors("");
      setYear("");
      setIsbn("");
      setPhoto(null);
      setCondition(2);
      titleRef.current?.focus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {prefill.notFound && (
        <Notice tone="accent">{t.notFound(prefill.isbn ?? "")}</Notice>
      )}

      <div className="rounded-[10px] border border-line p-4 md:p-6 grid sm:grid-cols-[minmax(0,1fr)_120px] gap-x-5 gap-y-5">
        <div className="space-y-5 min-w-0">
          <Field label={t.title} error={error}>
            <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} required autoComplete="off" />
          </Field>
          <Field label={t.author} hint={t.authorHint}>
            <Input value={authors} onChange={(e) => setAuthors(e.target.value)} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.year}>
              <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1962" />
            </Field>
            <Field label={t.language}>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {Object.entries(L.languageLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="">{t.other}</option>
              </Select>
            </Field>
          </div>
          <Field label={<>ISBN <span className="text-muted font-normal">{t.isbnIf}</span></>}>
            <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" autoComplete="off" />
          </Field>
        </div>

        {/* Foto als Cover-Fläche im Buchformat */}
        <div className="sm:order-none order-first">
          <span className="block text-[13px] font-medium mb-1.5">{t.photo} <span className="text-muted font-normal">{t.optional}</span></span>
          <label className={cx("relative grid place-items-center w-[96px] sm:w-full aspect-[2/3] rounded-[8px] cursor-pointer overflow-hidden transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]",
            preview ? "border border-line" : "border border-dashed border-line-strong hover:border-accent text-muted hover:text-accent-hover bg-paper-2/50")}>
            {preview ? (
               
              <img src={preview} alt={t.preview} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-[12.5px] font-medium text-center px-2"><IconCamera width={22} height={22} /> {t.takePhoto}</span>
            )}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo ? (
            <button type="button" className="text-[12.5px] text-muted hover:text-ink mt-2" onClick={() => setPhoto(null)}>{t.removePhoto}</button>
          ) : (
            <p className="text-[12px] text-muted mt-2 leading-snug">{t.noPhoto}</p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <p className="font-medium text-[15px]">{c.condition}</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">{t.readingTraces}</p>
        <ConditionGrid value={condition} onPick={setCondition} />
      </div>

      {ask && (
        <div className="pt-4">
          <p className="font-medium text-[15px]">{c.precious}</p>
          <p className="text-[13px] text-muted mt-0.5 mb-3">{c.preciousShort}</p>
          <div role="radiogroup" aria-label={t.choice} className="grid grid-cols-2 gap-2 sm:max-w-md">
            <OptionCard compact on={!precious} onClick={() => setPrecious(false)} title={t.no} desc={t.noDesc} />
            <OptionCard compact on={precious} onClick={() => setPrecious(true)} title={c.yesCircles} desc={t.yesDesc} />
          </div>
        </div>
      )}

      <div className="pt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
          {busy ? t.adding : t.add}
        </Button>
        <p className="text-[13px] text-muted">{t.ready}</p>
      </div>
    </form>
  );
}
