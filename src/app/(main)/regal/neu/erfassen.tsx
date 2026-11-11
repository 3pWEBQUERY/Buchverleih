"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Edition } from "@/lib/catalog/works";
import { api, uploadPhoto } from "@/lib/client";
import { conditionHint, conditionLabel, languageLabel } from "@/lib/i18n/de-CH";
import { Cover, type CoverData } from "@/components/cover";
import { Scanner } from "@/components/scanner";
import { useToast } from "@/components/toast";
import { OptionCard } from "@/components/form-controls";
import { StepSection } from "@/components/step-section";
import { Button, Field, Input, LinkButton, Notice, Select, cx } from "@/components/ui";
import { IconArrowRight, IconCamera, IconCheck, IconClose, IconScan, IconSearch } from "@/components/icons";

export type Added = { id: string; title: string; authors: string[]; condition: number; circlesOnly: boolean; cover: CoverData };
type Tab = "scan" | "search" | "manual";

const IconPen = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  </svg>
);

const TABS: { id: Tab; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "scan", label: "Scannen", desc: "Strichcode auf der Rückseite, mit der Kamera.", icon: <IconScan /> },
  { id: "search", label: "Suchen", desc: "Nach Titel, Autorin oder Autor.", icon: <IconSearch /> },
  { id: "manual", label: "Ohne ISBN", desc: "Ältere Bücher von Hand erfassen.", icon: <IconPen /> },
];
const STEP2: Record<Tab, { title: string; desc: string }> = {
  scan: { title: "Strichcode scannen", desc: "Halte den Strichcode in den Rahmen. Nach jedem Treffer geht es gleich weiter – ideal für mehrere Bücher am Stück." },
  search: { title: "Ausgabe suchen", desc: "Gefunden werden Bücher, die schon jemand erfasst hat. Eine ISBN kannst du hier auch eintippen." },
  manual: { title: "Angaben eintragen", desc: "Titel genügt. Alles andere ist freiwillig und hilft beim Finden." },
};
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
  const [noCamera, setNoCamera] = useState(false);
  const step3 = useRef<HTMLDivElement>(null);

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

  // Nach einem Treffer den Zustandsschritt ins Bild holen
  useEffect(() => {
    if (pending || looking) step3.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pending, looking]);

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

  const done = async (cond: number, precious: boolean) => {
    if (!pending) return;
    await add(pending, cond, precious);
    setPending(null);
  };

  return (
    <div>
      <header className="anim-rise">
        <p className="eyebrow">Mein Regal</p>
        <h1 className="display text-[44px] md:text-[64px] mt-2">Buch erfassen. <em>Scannen, antippen, fertig.</em></h1>
        <p className="text-[16px] md:text-[17px] text-ink-2 mt-4 max-w-2xl">
          Alles Weitere hat Standardwerte: verleihbar für 28 Tage, sichtbar für alle in deiner Umgebung. Ändern kannst du das später bei jedem Buch.
        </p>
      </header>

      <div className="mt-10 md:mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-x-10 xl:gap-x-16 gap-y-12 items-start">
        <div className="min-w-0">
          {/* 01 – Weg wählen */}
          <StepSection n={1} first title="Wie findest du das Buch?">
            <div role="radiogroup" aria-label="Wie du das Buch erfasst" className="grid grid-cols-3 gap-2 sm:gap-3">
              {TABS.map((t) => (
                <OptionCard key={t.id} on={tab === t.id} onClick={() => switchTab(t.id)} icon={t.icon} title={t.label} desc={t.desc} descDesktopOnly />
              ))}
            </div>
          </StepSection>

          {/* 02 – Buch finden */}
          <StepSection id="finden" n={2} title={STEP2[tab].title} desc={STEP2[tab].desc}>
            {tab === "scan" && (
              <div className="space-y-4">
                <div className="rounded-[12px] border border-line bg-paper-2 p-2.5 md:p-3">
                  <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2.5">
                    <p className="text-[12.5px] font-medium text-ink-2 flex items-center gap-2">
                      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", noCamera ? "bg-done" : pending || looking ? "bg-wait" : "bg-accent live-dot")} />
                      {noCamera ? "Keine Kamera" : looking ? "Schlägt nach …" : pending ? "Pausiert, bis du den Zustand gewählt hast" : "Kamera bereit"}
                    </p>
                    <p className="text-[12.5px] text-muted hidden sm:block">EAN mit 978 oder 979</p>
                  </div>
                  <div className={cx("overflow-hidden rounded-[8px] transition-[max-height] duration-300 ease-[var(--ease-out-quart)]", pending || looking ? "max-h-32" : "max-h-[70vh]")}>
                    <Scanner mode="isbn" continuous paused={Boolean(pending || looking)} onResult={lookup} fallbackHint="Gib die ISBN unten von Hand ein." className="!rounded-[8px] bg-paper" onUnavailable={() => setNoCamera(true)} />
                  </div>
                </div>

                {!pending && !looking && (
                  <form className="rounded-[10px] border border-line p-4 md:p-5" onSubmit={(e) => { e.preventDefault(); if (manualIsbn.trim()) lookup(manualIsbn); }}>
                    <label htmlFor="isbn-hand" className="font-medium text-[15px] block">ISBN von Hand</label>
                    <p className="text-[13px] text-muted mt-0.5 mb-3">Die Ziffern unter dem Strichcode, mit oder ohne Bindestriche.</p>
                    <div className="flex gap-2">
                      <Input id="isbn-hand" className="flex-1 min-w-0" value={manualIsbn} onChange={(e) => setManualIsbn(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="978 3 15 009152 1" />
                      <Button type="submit" variant="secondary" className="h-12 flex-none" disabled={manualIsbn.replace(/\D/g, "").length < 10}>Nachschlagen</Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {tab === "search" && (
              <SearchTab hidden={Boolean(pending)} onPick={setPending} onIsbn={(q) => { switchTab("scan"); lookup(q); }} onManual={(title) => { setPrefill({ title }); setTab("manual"); }} />
            )}

            {tab === "manual" && (
              <ManualTab key={`${prefill.isbn ?? ""}|${prefill.title ?? ""}`} prefill={prefill} ask={!asked} onAsked={markAsked} add={add} />
            )}
          </StepSection>

          {/* 03 – Zustand */}
          {tab !== "manual" && (
            <div ref={step3} className="scroll-mt-28">
              <StepSection n={3} title="Zustand antippen" desc="Ein Tippen genügt – danach steht das Buch im Regal. Normale Lesespuren sind kein Schaden.">
                {looking ? <LookupSkeleton isbn={looking} />
                  : pending ? <PendingCard key={pending.id} edition={pending} ask={!asked} onAsked={markAsked} onCancel={() => setPending(null)} onDone={done} />
                  : (
                    <div className="rounded-[10px] border border-dashed border-line-strong px-5 py-6 text-[15px] text-muted">
                      {tab === "scan" ? "Sobald ein Strichcode erkannt ist, erscheint das Buch hier." : "Wähle oben eine Ausgabe, dann erscheint sie hier."}
                    </div>
                  )}
              </StepSection>
            </div>
          )}
        </div>

        {/* ------------------------------------------------ Heute erfasst */}
        <aside className="lg:sticky lg:top-8 min-w-0" aria-labelledby="heute">
          <div className="rounded-[10px] border border-line overflow-hidden">
            <div className="flex items-end justify-between gap-4 px-5 pt-5 pb-4">
              <div>
                <h2 id="heute" className="text-[19px] font-[560] tracking-[-0.025em]">Heute erfasst</h2>
                <p className="text-[13px] text-muted mt-0.5">{added.length === 0 ? "Noch nichts" : "Neueste zuerst"}</p>
              </div>
              <span className="text-[34px] font-[560] tracking-[-0.04em] leading-none tnum">{added.length}</span>
            </div>
            {added.length === 0 ? (
              <div className="px-5 pb-6 flex items-end gap-4 border-t border-line pt-5">
                <div aria-hidden className="flex items-end gap-1.5 flex-none">
                  {[0, 1, 2].map((i) => <span key={i} className="block w-[28px] h-[42px] rounded-[3px] border border-dashed border-line-strong" />)}
                </div>
                <p className="text-ink-2 text-[14px] leading-snug">Das erste Buch erscheint hier, sobald du den Zustand angetippt hast.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line max-h-[56vh] overflow-y-auto">
                {added.map((a) => (
                  <li key={a.id} className={cx("flex items-center gap-3.5 px-5 py-3", a.id === fresh && "anim-flash")}>
                    <Cover data={a.cover} width={36} height={54} uniform />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[16.5px] leading-tight truncate">{a.title}</p>
                      <p className="text-[12.5px] text-muted truncate mt-0.5">
                        {conditionLabel[a.condition]}{a.circlesOnly ? " · nur Kreise" : ""}{a.authors[0] ? ` · ${a.authors[0]}` : ""}
                      </p>
                    </div>
                    <Link href={`/regal/${a.id}`} className="text-[13px] font-medium text-accent-hover hover:underline underline-offset-4 flex-none py-2">Bearbeiten</Link>
                  </li>
                ))}
              </ul>
            )}
            {added.length > 0 && (
              <div className="px-5 py-4 border-t border-line">
                <LinkButton href="/regal" variant="secondary" className="w-full">Zum Regal <IconArrowRight width={16} height={16} /></LinkButton>
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
    <div className="rounded-[10px] border border-line flex gap-5 p-5" aria-live="polite">
      <div className="skeleton w-[80px] h-[120px] flex-none" />
      <div className="flex-1 pt-1">
        <p className="text-sm text-muted tnum">ISBN {isbn} wird nachgeschlagen …</p>
        <div className="skeleton h-5 w-3/4 mt-3" />
        <div className="skeleton h-4 w-1/2 mt-2" />
      </div>
    </div>
  );
}

/** Nach einem Treffer: Ausgabe prüfen, Zustand antippen, fertig. */
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

  const meta = [edition.publisher, edition.year].filter(Boolean).join(", ");
  return (
    <div className="anim-rise" aria-live="polite">
      <div className="rounded-[10px] border border-line p-4 md:p-5 flex gap-4 md:gap-5">
        <div className="anim-cover flex-none"><Cover data={coverOf(edition)} width={80} height={120} uniform priority /></div>
        <div className="min-w-0 flex-1 flex flex-col">
          <p className="text-[13px] font-medium text-ok flex items-center gap-1.5"><IconCheck width={15} height={15} strokeWidth={2} /> Gefunden</p>
          <h3 className="font-serif text-[22px] md:text-[26px] leading-[1.1] mt-1.5">{edition.title}</h3>
          <p className="text-[14.5px] text-ink-2 mt-1">{edition.authors.join(", ")}</p>
          <dl className="mt-auto pt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            {meta && <div className="flex gap-1.5"><dt className="text-muted">Ausgabe</dt><dd>{meta}</dd></div>}
            {edition.isbn13 && <div className="flex gap-1.5"><dt className="text-muted">ISBN</dt><dd className="tnum">{edition.isbn13}</dd></div>}
          </dl>
        </div>
        <button type="button" onClick={onCancel} className="self-start h-10 w-10 -mt-1.5 -mr-1.5 grid place-items-center rounded-[6px] text-muted hover:text-ink hover:bg-paper-2 transition-colors flex-none" aria-label="Anderes Buch">
          <IconClose />
        </button>
      </div>

      {condition === null ? (
        <fieldset className="mt-4" disabled={busy}>
          <legend className="sr-only">In welchem Zustand ist es?</legend>
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
            <span className="block text-[17px] font-[560] tracking-[-0.02em] leading-tight mt-auto pt-4">{conditionLabel[c]}</span>
            <span className="block text-[12.5px] leading-snug mt-1 text-muted">{conditionHint[c]}</span>
          </button>
        );
      })}
    </div>
  );
}

function PreciousQuestion({ busy, condition, onBack, onAnswer }: { busy: boolean; condition: number; onBack: () => void; onAnswer: (yes: boolean) => void }) {
  return (
    <div className="mt-4 rounded-[10px] bg-paper-2 p-5 md:p-6 anim-rise">
      <p className="text-[13px] text-muted">
        Zustand: <span className="text-ink-2 font-medium">{conditionLabel[condition]}</span>{" "}
        <button type="button" onClick={onBack} className="text-accent-hover font-medium hover:underline underline-offset-4 ml-1">ändern</button>
      </p>
      <p className="text-[20px] md:text-[24px] font-[560] tracking-[-0.03em] leading-[1.15] mt-2 max-w-xl">Würde es dich schmerzen, wenn dieses Buch nicht zurückkommt?</p>
      <p className="text-[14px] text-muted mt-2 max-w-xl">Bei Ja sehen es nur Mitglieder deiner Kreise. Diese Frage kommt einmal pro Sitzung, ändern kannst du es bei jedem Buch.</p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => onAnswer(true)}>Ja, nur Kreise</Button>
        <Button size="lg" variant="primary" disabled={busy} onClick={() => onAnswer(false)}>Nein, ins Regal</Button>
      </div>
    </div>
  );
}

function SearchTab({ hidden, onPick, onIsbn, onManual }: {
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

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (isbnLike(q)) onIsbn(q); }} className="relative">
        <IconSearch width={18} height={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="z. B. Fontane Effi" aria-label="Titel, Autorin oder Autor" className="!pl-11" />
      </form>

      {isbnLike(q) && (
        <div className="mt-3">
          <Button variant="primary" onClick={() => onIsbn(q)}>ISBN {q.replace(/[^\dXx]/g, "")} nachschlagen</Button>
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
        <ul className={cx("mt-4 rounded-[10px] border border-line divide-y divide-line overflow-hidden transition-opacity", loading && "opacity-60")} aria-label="Ausgaben">
          {res.editions.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="group w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-paper-2 focus-visible:bg-paper-2 transition-colors">
                <Cover data={coverOf(e)} width={40} height={60} uniform />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[17px] leading-tight">{e.title}</span>
                  <span className="block text-[13px] text-muted truncate mt-0.5">
                    {[e.authors.join(", "), e.publisher, e.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="h-9 px-3.5 rounded-[6px] bg-accent-soft text-accent-hover text-[13.5px] font-medium flex-none hidden sm:inline-flex items-center gap-1.5 group-hover:bg-accent group-hover:text-accent-ink transition-colors">
                  Wählen <IconArrowRight width={14} height={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!hidden && res && (
        <div className={cx("flex flex-wrap items-center justify-between gap-4", res.editions.length ? "mt-4" : "mt-4 rounded-[10px] border border-dashed border-line-strong px-5 py-5")}>
          <p className={res.editions.length ? "text-[14px] text-muted" : "text-ink-2 text-[15px]"}>
            {res.editions.length ? "Nicht dabei?" : `Zu «${res.q}» kennen wir noch keine Ausgabe.`}
          </p>
          <Button size="sm" variant="secondary" onClick={() => onManual(res.q)}>Ohne ISBN erfassen</Button>
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
        <Notice tone="accent">Zur ISBN {prefill.isbn} haben wir in keinem Katalog etwas gefunden. Erfasse das Buch hier von Hand.</Notice>
      )}

      <div className="rounded-[10px] border border-line p-4 md:p-6 grid sm:grid-cols-[minmax(0,1fr)_120px] gap-x-5 gap-y-5">
        <div className="space-y-5 min-w-0">
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
        </div>

        {/* Foto als Cover-Fläche im Buchformat */}
        <div className="sm:order-none order-first">
          <span className="block text-[13px] font-medium mb-1.5">Foto <span className="text-muted font-normal">(freiwillig)</span></span>
          <label className={cx("relative grid place-items-center w-[96px] sm:w-full aspect-[2/3] rounded-[8px] cursor-pointer overflow-hidden transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]",
            preview ? "border border-line" : "border border-dashed border-line-strong hover:border-accent text-muted hover:text-accent-hover bg-paper-2/50")}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vorschau des Fotos" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-[12.5px] font-medium text-center px-2"><IconCamera width={22} height={22} /> Foto aufnehmen</span>
            )}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo ? (
            <button type="button" className="text-[12.5px] text-muted hover:text-ink mt-2" onClick={() => setPhoto(null)}>Foto entfernen</button>
          ) : (
            <p className="text-[12px] text-muted mt-2 leading-snug">Ohne Foto zeigen wir ein Cover aus Titel und Autor.</p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <p className="font-medium text-[15px]">Zustand</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">Normale Lesespuren sind kein Schaden.</p>
        <ConditionGrid value={condition} onPick={setCondition} />
      </div>

      {ask && (
        <div className="pt-4">
          <p className="font-medium text-[15px]">Würde es dich schmerzen, wenn dieses Buch nicht zurückkommt?</p>
          <p className="text-[13px] text-muted mt-0.5 mb-3">Bei Ja sehen es nur Mitglieder deiner Kreise.</p>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:max-w-md">
            <OptionCard compact on={!precious} onClick={() => setPrecious(false)} title="Nein" desc="Sichtbar in der Umgebung" />
            <OptionCard compact on={precious} onClick={() => setPrecious(true)} title="Ja, nur Kreise" desc="Nur für Bekannte" />
          </div>
        </div>
      )}

      <div className="pt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
          {busy ? "Wird eingestellt …" : "Ins Regal stellen"}
        </Button>
        <p className="text-[13px] text-muted">Danach ist das Formular gleich wieder bereit für das nächste Buch.</p>
      </div>
    </form>
  );
}
