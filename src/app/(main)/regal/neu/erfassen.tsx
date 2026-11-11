"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Edition } from "@/lib/catalog/works";
import { api, uploadPhoto } from "@/lib/client";
import { conditionHint, conditionLabel, languageLabel } from "@/lib/i18n/de-CH";
import { Cover, type CoverData } from "@/components/cover";
import { Scanner } from "@/components/scanner";
import { useToast } from "@/components/toast";
import { Button, Field, Input, LinkButton, Notice, PageTitle, Segmented, Select, cx } from "@/components/ui";
import { IconCamera, IconCheck, IconClose } from "@/components/icons";

export type Added = { id: string; title: string; authors: string[]; condition: number; circlesOnly: boolean; cover: CoverData };
type Tab = "scan" | "search" | "manual";

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "Scannen" },
  { id: "search", label: "Suchen" },
  { id: "manual", label: "Ohne ISBN" },
];
const CONDITIONS = [1, 2, 3, 4] as const;
const ASKED_KEY = "lr_precious_asked";
const isbnLike = (s: string) => /^[\d\s-]{9,17}[\dXx]$/.test(s.trim()) && s.replace(/[^\dXx]/g, "").length >= 10;
const coverOf = (e: Edition): CoverData => ({ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id });

export function Erfassen({ initial }: { initial: Added[] }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("scan");
  const [added, setAdded] = useState<Added[]>(initial);
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, setPending] = useState<Edition | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState("");
  const [prefill, setPrefill] = useState<{ isbn?: string; title?: string; notFound?: boolean }>({});
  const [asked, setAsked] = useState(true);

  // Die Frage nach dem Wert des Buchs kommt einmal pro Sitzung (PRD 6.1)
  useEffect(() => {
    try {
      setAsked(sessionStorage.getItem(ASKED_KEY) === "1");
    } catch {
      setAsked(false);
    }
  }, []);
  function markAsked() {
    setAsked(true);
    try {
      sessionStorage.setItem(ASKED_KEY, "1");
    } catch {}
  }

  async function lookup(raw: string) {
    const isbn = raw.replace(/[^\dXx]/g, "");
    if (!/^97[89]\d{10}$/.test(isbn) && !/^\d{9}[\dXx]$/.test(isbn)) {
      toast.error("Das ist keine ISBN. Scanne den Strichcode, der mit 978 oder 979 beginnt.");
      return;
    }
    setLooking(isbn);
    try {
      const r = await api<{ edition: Edition | null }>(`/catalog/isbn/${isbn}`);
      if (r.edition) {
        setPending(r.edition);
        setManualIsbn("");
      } else {
        setPrefill({ isbn, notFound: true });
        setTab("manual");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLooking(null);
    }
  }

  async function add(edition: Edition, condition: number, precious: boolean, photo?: File | null) {
    const r = await api<{ id: string }>("/copies", { body: { editionId: edition.id, condition, ...(precious ? { precious: true } : {}) } });
    const item: Added = { id: r.id, title: edition.title, authors: edition.authors, condition, circlesOnly: precious, cover: coverOf(edition) };
    if (photo) {
      try {
        const up = await uploadPhoto(photo, "copy_photo", r.id);
        await api(`/copies/${r.id}/photos`, { body: { uploadId: up.id } });
        item.cover = { ...item.cover, photoKey: up.key };
      } catch (e) {
        toast.error(`Das Buch ist im Regal, aber das Foto fehlt. ${(e as Error).message}`);
      }
    }
    setAdded((a) => [item, ...a]);
    setFresh(item.id);
    toast.show({
      text: `«${edition.title}» steht im Regal.`,
      undo: async () => {
        try {
          await api(`/copies/${r.id}`, { method: "DELETE" });
          setAdded((a) => a.filter((x) => x.id !== r.id));
        } catch (e) {
          toast.error((e as Error).message);
        }
      },
    });
  }

  function switchTab(t: Tab) {
    setTab(t);
    setPending(null);
    if (t !== "manual") setPrefill({});
  }

  return (
    <div>
      <PageTitle sub="Scannen, Zustand antippen, fertig. Alles Weitere hat Standardwerte und lässt sich später ändern.">Buch <em>erfassen</em></PageTitle>

      <div className="grid lg:grid-cols-12 gap-x-10 gap-y-12">
        <div className="lg:col-span-7 min-w-0">
          <div role="tablist" aria-label="Wie du das Buch erfasst" className="grid grid-cols-3 sm:inline-grid gap-1 p-1 bg-paper-2 rounded-full mb-6 w-full sm:w-auto">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                onClick={() => switchTab(t.id)}
                className={cx("h-10 px-5 rounded-[6px] text-[14px] font-semibold whitespace-nowrap transition-[background-color,color] duration-200", tab === t.id ? "bg-accent-soft text-accent-hover" : "text-ink-2 hover:bg-paper-3")}>
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "scan" && (
              <div className="space-y-5">
                {/* Die Bühne: Kamera auf dunkler Fläche */}
                <div className="surface-night rounded-[12px] p-3 md:p-4">
                  <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-3">
                    <p className="text-[12px] font-medium text-night-muted flex items-center gap-2">
                      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", pending || looking ? "bg-night-muted" : "bg-accent live-dot")} />
                      {looking ? "Schlägt nach" : pending ? "Pausiert" : "Kamera bereit"}
                    </p>
                    <p className="text-[12.5px] text-night-muted hidden sm:block">Strichcode mit 978 oder 979</p>
                  </div>
                  <div className={cx("overflow-hidden rounded-[14px] transition-[max-height] duration-300 ease-[var(--ease-out-quart)]", pending || looking ? "max-h-32" : "max-h-[70vh]")}>
                    <Scanner mode="isbn" continuous paused={Boolean(pending || looking)} onResult={lookup} fallbackHint="Gib die ISBN unten von Hand ein." className="!rounded-[8px] !border-night-line" />
                  </div>
                  <p className="text-[13.5px] text-night-muted px-2 pt-3 pb-1">Halte den Strichcode auf der Rückseite in den Rahmen. Nach jedem Treffer geht es gleich weiter.</p>
                </div>

                {looking && <LookupSkeleton isbn={looking} />}
                {pending && !looking && (
                  <PendingCard key={pending.id} edition={pending} ask={!asked} onAsked={markAsked} onCancel={() => setPending(null)}
                    onDone={async (cond, precious) => { await add(pending, cond, precious); setPending(null); }} />
                )}

                {!pending && !looking && (
                  <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (manualIsbn.trim()) lookup(manualIsbn); }}>
                    <Field label="Oder die ISBN von Hand" className="flex-1">
                      <Input value={manualIsbn} onChange={(e) => setManualIsbn(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="978 3 15 009152 1" />
                    </Field>
                    <Button type="submit" className="h-12" disabled={manualIsbn.replace(/\D/g, "").length < 10}>Nachschlagen</Button>
                  </form>
                )}
              </div>
            )}

            {tab === "search" && (
              <SearchTab
                pending={pending}
                setPending={setPending}
                onIsbn={(q) => { switchTab("scan"); lookup(q); }}
                onManual={(title) => { setPrefill({ title }); setTab("manual"); }}
                ask={!asked}
                onAsked={markAsked}
                add={async (e, c, p) => { await add(e, c, p); setPending(null); }}
              />
            )}

            {tab === "manual" && (
              <ManualTab key={`${prefill.isbn ?? ""}|${prefill.title ?? ""}`} prefill={prefill} ask={!asked} onAsked={markAsked} add={add} />
            )}
          </div>
        </div>

        <aside className="lg:col-span-5 min-w-0 lg:sticky lg:top-8 self-start" aria-labelledby="heute">
          <div className="panel !rounded-[10px] overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 md:px-6 h-16 border-b border-line">
              <h2 id="heute" className="ui-title text-[19px]">Heute erfasst</h2>
              <span className="font-[520] tracking-[-0.035em] text-[28px] leading-none tnum">{added.length}</span>
            </div>
            {added.length === 0 ? (
              <div className="px-5 md:px-6 py-7 flex items-end gap-5">
                <div aria-hidden className="flex items-end gap-1 h-[72px] flex-none opacity-80">
                  {[0, 1, 2].map((i) => <span key={i} className="block w-[22px] rounded-[3px] bg-paper-3" style={{ height: 52 + i * 10 }} />)}
                </div>
                <p className="text-ink-2 text-[15px]">Noch nichts. Das erste Buch erscheint hier, sobald du den Zustand angetippt hast.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
                {added.map((a) => (
                  <li key={a.id} className={cx("flex items-center gap-4 px-5 md:px-6 py-3", a.id === fresh && "anim-flash")}>
                    <Cover data={a.cover} height={60} />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[19px] leading-tight truncate">{a.title}</p>
                      <p className="text-[13px] text-muted truncate mt-0.5">
                        {conditionLabel[a.condition]}{a.circlesOnly ? " · nur Kreise" : ""}{a.authors[0] ? ` · ${a.authors[0]}` : ""}
                      </p>
                    </div>
                    <Link href={`/regal/${a.id}`} className="text-[13.5px] font-medium text-muted hover:text-ink link-grow flex-none py-2">Bearbeiten</Link>
                  </li>
                ))}
              </ul>
            )}
            {added.length > 0 && (
              <div className="px-5 md:px-6 py-4 border-t border-line">
                <LinkButton href="/regal" variant="ghost" size="sm">Zum Regal</LinkButton>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LookupSkeleton({ isbn }: { isbn: string }) {
  return (
    <div className="panel !rounded-[10px] flex gap-4 p-5" aria-live="polite">
      <div className="skeleton w-[80px] h-[120px] flex-none" />
      <div className="flex-1 pt-1">
        <p className="text-sm text-muted">ISBN {isbn} wird nachgeschlagen …</p>
        <div className="skeleton h-5 w-3/4 mt-3" />
        <div className="skeleton h-4 w-1/2 mt-2" />
      </div>
    </div>
  );
}

/** Karte nach einem Treffer: Titel prüfen, Zustand antippen, fertig. */
function PendingCard({ edition, ask, onAsked, onCancel, onDone }: {
  edition: Edition; ask: boolean; onAsked: () => void; onCancel: () => void; onDone: (condition: number, precious: boolean) => Promise<void>;
}) {
  const [condition, setCondition] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

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

  const meta = [edition.publisher, edition.year, edition.isbn13].filter(Boolean).join(" · ");
  return (
    <div className="anim-rise panel !rounded-[10px] p-5 md:p-6" aria-live="polite">
      <div className="flex gap-4 md:gap-5">
        <div className="anim-cover flex-none"><Cover data={coverOf(edition)} height={128} priority /></div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-1.5"><IconCheck width={14} height={14} strokeWidth={2} className="text-ok" /> Gefunden</p>
          <h2 className="text-[30px] md:text-[36px] leading-[1.02] mt-2">{edition.title}</h2>
          <p className="text-ink-2 mt-1.5">{edition.authors.join(", ")}</p>
          {meta && <p className="text-[13px] text-muted mt-1 tnum">{meta}</p>}
        </div>
        <button type="button" onClick={onCancel} className="self-start h-10 w-10 -mt-1 -mr-1 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-paper-2 transition-colors flex-none" aria-label="Anderes Buch">
          <IconClose />
        </button>
      </div>

      {condition === null ? (
        <fieldset className="mt-6" disabled={busy}>
          <legend className="text-[13px] font-semibold mb-2.5">In welchem Zustand ist es?</legend>
          <ConditionGrid onPick={pick} />
        </fieldset>
      ) : (
        <PreciousQuestion busy={busy} onAnswer={(yes) => { onAsked(); finish(condition, yes); }} />
      )}
    </div>
  );
}

/** Vier grosse Karten; die Striche zeigen, wie viele Spuren das Buch hat */
function ConditionGrid({ onPick, value }: { onPick: (c: number) => void; value?: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CONDITIONS.map((c) => {
        const on = value === c;
        return (
          <button key={c} type="button" onClick={() => onPick(c)} aria-pressed={on}
            className={cx(
              "group flex flex-col items-start text-left rounded-[8px] p-4 min-h-[118px] border transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] disabled:opacity-45",
              on ? "bg-ink text-paper border-ink" : "bg-paper border-line hover:border-ink",
            )}>
            <span aria-hidden className="flex gap-1">
              {[1, 2, 3, 4].map((k) => (
                <span key={k} className={cx("h-1.5 w-4 rounded-full transition-colors", k >= c ? (on ? "bg-paper" : "bg-ink") : (on ? "bg-paper/25" : "bg-paper-3"))} />
              ))}
            </span>
            <span className="block font-serif text-[22px] md:text-[24px] leading-none mt-auto pt-4">{conditionLabel[c]}</span>
            <span className={cx("block text-[13px] leading-snug mt-1.5", on ? "text-paper/75" : "text-muted")}>{conditionHint[c]}</span>
          </button>
        );
      })}
    </div>
  );
}

function PreciousQuestion({ busy, onAnswer }: { busy: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div className="mt-6 pt-6 border-t border-line anim-rise">
      <p className="font-serif text-[26px] leading-[1.08]">Würde es dich schmerzen, wenn dieses Buch nicht zurückkommt?</p>
      <p className="text-[14px] text-muted mt-2">Bei Ja sehen es nur Mitglieder deiner Kreise. Du kannst das bei jedem Buch später ändern.</p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button size="lg" disabled={busy} onClick={() => onAnswer(true)}>Ja, nur Kreise</Button>
        <Button size="lg" variant="ghost" disabled={busy} onClick={() => onAnswer(false)}>Nein</Button>
      </div>
    </div>
  );
}

function SearchTab({ pending, setPending, onIsbn, onManual, ask, onAsked, add }: {
  pending: Edition | null;
  setPending: (e: Edition | null) => void;
  onIsbn: (q: string) => void;
  onManual: (title: string) => void;
  ask: boolean;
  onAsked: () => void;
  add: (e: Edition, condition: number, precious: boolean) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; editions: Edition[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2 || isbnLike(needle)) {
      setRes(null);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
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
      clearTimeout(t);
    };
  }, [q, toast]);

  if (pending) {
    return <PendingCard key={pending.id} edition={pending} ask={ask} onAsked={onAsked} onCancel={() => setPending(null)} onDone={(c, p) => add(pending, c, p)} />;
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (isbnLike(q)) onIsbn(q); }}>
        <Field label="Titel, Autorin oder Autor" hint="Gefunden werden Bücher, die schon jemand erfasst hat. Eine ISBN kannst du hier auch eintippen.">
          <Input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="z. B. Fontane Effi" />
        </Field>
      </form>

      {isbnLike(q) && (
        <div className="mt-4">
          <Button onClick={() => onIsbn(q)}>ISBN {q.replace(/[^\dXx]/g, "")} nachschlagen</Button>
        </div>
      )}

      {loading && !res && (
        <ul className="mt-6 panel divide-y divide-line px-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-4 py-3">
              <div className="skeleton w-[42px] h-[64px] flex-none" />
              <div className="flex-1 pt-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3 mt-2" /></div>
            </li>
          ))}
        </ul>
      )}

      {res && res.editions.length > 0 && (
        <ul className={cx("mt-6 panel !rounded-[10px] divide-y divide-line overflow-hidden transition-opacity", loading && "opacity-60")} aria-label="Ausgaben">
          {res.editions.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setPending(e)} className="group w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-paper-2 focus-visible:bg-paper-2 transition-colors">
                <Cover data={coverOf(e)} height={64} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[20px] leading-tight">{e.title}</span>
                  <span className="block text-sm text-muted truncate">
                    {[e.authors.join(", "), e.publisher, e.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="h-9 px-4 rounded-[6px] border border-line-strong text-[13.5px] font-semibold flex-none hidden sm:inline-flex items-center group-hover:bg-ink group-hover:text-paper group-hover:border-ink transition-colors">Wählen</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {res && (
        <div className={cx("flex flex-wrap items-center justify-between gap-4", res.editions.length ? "mt-5" : "mt-6 panel-quiet px-6 py-7")}>
          <p className={res.editions.length ? "text-sm text-muted" : "text-ink-2"}>
            {res.editions.length ? "Nicht dabei?" : `Zu «${res.q}» kennen wir noch keine Ausgabe.`}
          </p>
          <Button size="sm" onClick={() => onManual(res.q)}>Ohne ISBN erfassen</Button>
        </div>
      )}
    </div>
  );
}

function ManualTab({ prefill, ask, onAsked, add }: {
  prefill: { isbn?: string; title?: string; notFound?: boolean };
  ask: boolean;
  onAsked: () => void;
  add: (e: Edition, condition: number, precious: boolean, photo?: File | null) => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(prefill.title ?? "");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [language, setLanguage] = useState("de");
  const [isbn, setIsbn] = useState(prefill.isbn ?? "");
  const [condition, setCondition] = useState<number>(2);
  const [precious, setPrecious] = useState<"no" | "yes">("no");
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
      setError("Gib den Titel ein, so wie er auf dem Buch steht.");
      titleRef.current?.focus();
      return;
    }
    const y = year.trim() ? Number(year) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1450 || y > 2100)) {
      setError(null);
      toast.error("Das Jahr sieht nicht richtig aus. Gib es mit vier Ziffern ein, zum Beispiel 1962.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ edition: Edition }>("/catalog/editions", {
        body: {
          title: title.trim(),
          authors: authors.split(/[,;]| und /).map((a) => a.trim()).filter(Boolean),
          year: y,
          language: language || null,
          isbn: isbn.trim() || null,
        },
      });
      const yes = ask && precious === "yes";
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
    <form onSubmit={submit} className="panel !rounded-[10px] p-5 md:p-8 space-y-6" noValidate>
      {prefill.notFound && (
        <Notice tone="accent">Zur ISBN {prefill.isbn} haben wir in keinem Katalog etwas gefunden. Erfasse das Buch hier von Hand.</Notice>
      )}
      <Field label="Titel" error={error}>
        <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} required autoComplete="off" />
      </Field>
      <Field label="Autorin oder Autor" hint="Mehrere mit Komma trennen.">
        <Input value={authors} onChange={(e) => setAuthors(e.target.value)} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Jahr">
          <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1962" />
        </Field>
        <Field label="Sprache">
          <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {Object.entries(languageLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="">Andere</option>
          </Select>
        </Field>
      </div>
      <Field label={<>ISBN <span className="text-muted font-normal">(falls vorhanden)</span></>}>
        <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" autoComplete="off" />
      </Field>

      <div>
        <span className="block text-[13px] font-semibold mb-2">Foto <span className="text-muted font-normal">(freiwillig)</span></span>
        <div className="flex items-center gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vorschau des Fotos" className="h-20 w-auto rounded-[6px] outline outline-1 -outline-offset-1 outline-black/10" />
          )}
          <label className="inline-flex items-center gap-2 h-11 px-5 border border-line-strong rounded-[6px] text-[15px] font-semibold cursor-pointer hover:border-ink hover:bg-paper-2 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]">
            <IconCamera width={18} height={18} /> {photo ? "Anderes Foto" : "Foto aufnehmen"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo && <Button type="button" variant="quiet" className="text-sm" onClick={() => setPhoto(null)}>Entfernen</Button>}
        </div>
        <p className="text-sm text-muted mt-1.5">Ohne Foto zeigen wir ein Cover aus Titel und Autor.</p>
      </div>

      <div>
        <span className="block text-[13px] font-semibold mb-2">Zustand</span>
        <ConditionGrid value={condition} onPick={setCondition} />
      </div>

      {ask && (
        <div>
          <span className="block text-[13px] font-semibold mb-2">Würde es dich schmerzen, wenn dieses Buch nicht zurückkommt?</span>
          <Segmented name="Würde es dich schmerzen, wenn dieses Buch nicht zurückkommt?" value={precious} onChange={setPrecious}
            options={[{ value: "no", label: "Nein" }, { value: "yes", label: "Ja, nur Kreise" }]} />
          <p className="text-sm text-muted mt-1.5">Bei Ja sehen es nur Mitglieder deiner Kreise.</p>
        </div>
      )}

      <div className="pt-2">
        <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
          {busy ? "Wird eingestellt …" : "Ins Regal stellen"}
        </Button>
      </div>
    </form>
  );
}
