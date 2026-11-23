"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Edition } from "@/lib/catalog/works";
import { api, uploadPhoto } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { CAPTURE } from "@/lib/i18n/messages/capture";
import { Cover, type CoverData } from "@/components/cover";
import { Scanner } from "@/components/scanner";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { OptionCard } from "@/components/form-controls";
import { StepSection } from "@/components/step-section";
import { Button, Input, LinkButton, Notice, Segmented, cx } from "@/components/ui";
import { IconArrowRight, IconCamera, IconScan, IconSearch } from "@/components/icons";
import { ShelfPhotoTab } from "./shelf-photo";
import { LookupSkeleton, ManualTab, PendingCard, SearchTab, coverOf } from "./erfassen-parts";
import { StackBar, StackNote, StackReview, useStack } from "./stapel";
import { ImportLink } from "../import/import-client";

export type Added = { id: string; title: string; authors: string[]; condition: number; circlesOnly: boolean; cover: CoverData };
type Tab = "scan" | "search" | "manual" | "photo";

const IconPen = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  </svg>
);

const TABS: { id: Tab; icon: React.ReactNode }[] = [
  { id: "scan", icon: <IconScan /> },
  { id: "search", icon: <IconSearch /> },
  { id: "manual", icon: <IconPen /> },
  { id: "photo", icon: <IconCamera /> },
];
const ASKED_KEY = "lr_precious_asked";

export function Erfassen({ initial, library = null, shelfPhoto = false }: { initial: Added[]; library?: { id: string; name: string } | null; shelfPhoto?: boolean }) {
  const toast = useToast();
  const l = useLocale();
  const t = CAPTURE[l];
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
  const step2 = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  // Stapel: mehrere Bücher am Stück, Zustand und Sichtbarkeit am Schluss gemeinsam
  const s = useStack({
    libraryCircleId: library?.id,
    onCreated: (item) => { setAdded((a) => [item, ...a]); setFresh(item.id); },
    onDeleted: (ids) => setAdded((a) => a.filter((x) => !ids.includes(x.id))),
  });
  const b = t.batch;
  const batch = tab === "scan" && s.mode === "batch";
  const reviewing = batch && s.phase === "review";

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
      toast.error(t.notIsbn);
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
    const r = await api<{ id: string }>("/copies", { body: { editionId: edition.id, condition, ...(precious ? { precious: true } : {}), ...(library ? { libraryCircleId: library.id } : {}) } });
    const item: Added = { id: r.id, title: edition.title, authors: edition.authors, condition, circlesOnly: precious, cover: coverOf(edition) };
    if (photo) {
      try {
        const up = await uploadPhoto(photo, "copy_photo", r.id);
        await api(`/copies/${r.id}/photos`, { body: { uploadId: up.id } });
        item.cover = { ...item.cover, photoKey: up.key };
      } catch (e) {
        toast.error(t.photoMissing((e as Error).message));
      }
    }
    setAdded((a) => [item, ...a]);
    setFresh(item.id);
    toast.show({
      text: t.inShelf(edition.title),
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

  function switchTab(next: Tab) {
    setTab(next);
    setPending(null);
    if (next !== "manual") setPrefill({});
  }

  function byHand(isbn: string) {
    s.dismiss();
    setPrefill({ isbn, notFound: true });
    setTab("manual");
  }

  function resumeScan() {
    s.resume();
    step2.current?.focus({ preventScroll: true });
    step2.current?.scrollIntoView({ block: "start" });
  }

  const done = async (cond: number, precious: boolean) => {
    if (!pending) return;
    await add(pending, cond, precious);
    setPending(null);
  };

  return (
    <div>
      <header className="anim-rise">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="display text-display mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h1>
        <p className="text-body-lg text-ink-2 mt-3 leading-relaxed max-w-2xl">
          {t.lead}
        </p>
        {library ? (
          <Notice tone="accent" className="mt-5 max-w-2xl">
            <p>{t.library(library.name)}</p>
            <Link href={`/kreise/${library.id}#bibliothek`} className="mt-1 inline-flex font-medium underline underline-offset-4">{t.libraryBack}</Link>
          </Notice>
        ) : <ImportLink className="mt-3" />}
      </header>

      <div className="mt-10 md:mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-x-10 xl:gap-x-16 gap-y-12 items-start">
        <div className="min-w-0">
          {/* 01 – Weg wählen */}
          <StepSection n={1} first title={t.step1}>
            <div role="radiogroup" aria-label={t.step1Aria} className="grid grid-cols-2 gap-2 sm:gap-3">
              {TABS.map((x) => (
                <OptionCard key={x.id} on={tab === x.id} onClick={() => switchTab(x.id)} icon={x.icon} title={t.tabs[x.id][0]} desc={t.tabs[x.id][1]} descDesktopOnly />
              ))}
            </div>
          </StepSection>

          {/* 02 – Buch finden */}
          <div ref={step2} tabIndex={-1} className="outline-none">
          <StepSection id="finden" n={2} title={batch ? b.step2[0] : t.step2[tab][0]} desc={batch ? b.step2[1] : t.step2[tab][1]}>
            {tab === "scan" && (
              <div className="space-y-4">
                <div>
                  <Segmented name={b.modeAria} size="lg" className="sm:max-w-sm" value={s.mode}
                    onChange={(m) => { s.setMode(m); setPending(null); }}
                    options={[{ value: "single", label: b.single }, { value: "batch", label: s.stack.length ? b.stackN(s.stack.length) : b.stack }]} />
                  {batch && <p className="text-body-sm text-muted mt-2 max-w-2xl">{b.hint}</p>}
                </div>

                {reviewing ? (
                  <div className="rounded-md border border-dashed border-line-strong px-5 py-5 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-body text-ink-2">{b.summary(s.stack.length)}</p>
                    <Button variant="ghost" disabled={s.run !== null} onClick={resumeScan}>{b.resume}</Button>
                  </div>
                ) : (
                  <>
                    {batch && !s.online && <Notice>{b.offline}</Notice>}
                    <div className="rounded-lg border border-line bg-paper-2 p-2.5 md:p-3">
                      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2.5">
                        <p className="text-meta font-medium text-ink-2 flex items-center gap-2">
                          <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", noCamera ? "bg-done" : (batch ? s.looking || s.blocked : pending || looking) ? "bg-wait" : "bg-accent live-dot")} />
                          {noCamera ? t.cam.none
                            : batch ? (s.looking ? t.cam.looking : s.blocked ? b.camPaused : t.cam.ready)
                            : looking ? t.cam.looking : pending ? t.cam.paused : t.cam.ready}
                        </p>
                        <p className="text-meta text-muted hidden sm:block">{t.ean}</p>
                      </div>
                      <div ref={camera} className={cx("overflow-hidden rounded-md", !batch && (pending || looking) ? "max-h-32" : "max-h-[70vh]")}>
                        <Scanner mode="isbn" continuous paused={batch ? Boolean(s.looking || s.blocked) : Boolean(pending || looking)}
                          onResult={batch ? (code) => { void s.lookup(code, "scan"); } : lookup}
                          fallbackHint={t.fallback} className="!rounded-md bg-paper" onUnavailable={() => setNoCamera(true)} />
                      </div>
                    </div>

                    {batch && <StackNote s={s} onManual={byHand} />}

                    {(batch || (!pending && !looking)) && (
                      <form className="rounded-md border border-line p-4 md:p-5"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!manualIsbn.trim()) return;
                          if (!batch) return lookup(manualIsbn);
                          if (await s.lookup(manualIsbn, "manual")) setManualIsbn("");
                        }}>
                        <label htmlFor="isbn-hand" className="font-medium text-body block">{t.isbnHand}</label>
                        <p className="text-meta text-muted mt-0.5 mb-3">{t.isbnHandHint}</p>
                        <div className="flex gap-2">
                          <Input id="isbn-hand" className="flex-1 min-w-0 text-body sm:text-body-lg tnum" value={manualIsbn} onChange={(e) => setManualIsbn(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="978 3 15 009152 1" />
                          <Button type="submit" variant="secondary" className="h-12 flex-none" disabled={manualIsbn.replace(/\D/g, "").length < 10 || Boolean(batch && s.looking)}>{t.lookup}</Button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "search" && (
              <SearchTab hidden={Boolean(pending)} onPick={setPending} onIsbn={(q) => { switchTab("scan"); lookup(q); }} onManual={(title) => { setPrefill({ title }); setTab("manual"); }} />
            )}

            {tab === "photo" && (
              <ShelfPhotoTab enabled={shelfPhoto} libraryCircleId={library?.id}
                onAdded={(a) => { setAdded((x) => [a, ...x]); setFresh(a.id); }}
                onManual={(title) => { setPrefill({ title }); setTab("manual"); }} />
            )}
            {tab === "manual" && (
              <ManualTab key={`${prefill.isbn ?? ""}|${prefill.title ?? ""}`} prefill={prefill} ask={!asked} onAsked={markAsked} add={add} />
            )}
          </StepSection>
          </div>

          {/* 03 – Stapel: Zustand und Sichtbarkeit für alle */}
          {batch && (
            <StepSection n={3} title={b.step3} desc={b.step3Desc}>
              {reviewing ? <StackReview s={s} /> : (
                <div className="rounded-md border border-dashed border-line-strong px-5 py-6 text-body text-muted">{b.step3Wait}</div>
              )}
            </StepSection>
          )}

          {/* 03 – Zustand */}
          {tab !== "manual" && tab !== "photo" && !batch && (
            <div ref={step3} className="scroll-mt-28">
              <StepSection n={3} title={t.step3} desc={t.step3Desc}>
                {looking ? <LookupSkeleton isbn={looking} />
                  : pending ? <PendingCard key={pending.id} edition={pending} ask={!asked} onAsked={markAsked} onCancel={() => setPending(null)} onDone={done} />
                  : (
                    <div className="rounded-md border border-dashed border-line-strong px-5 py-6 text-body text-muted">
                      {tab === "scan" ? t.waitScan : t.waitPick}
                    </div>
                  )}
              </StepSection>
            </div>
          )}

          {batch && !reviewing && <StackBar s={s} origin={camera} />}
        </div>

        {/* ------------------------------------------------ Heute erfasst */}
        <aside className="lg:sticky lg:top-8 min-w-0" aria-labelledby="heute">
          <div className="rounded-md border border-line overflow-hidden">
            <div className="flex items-end justify-between gap-4 px-5 pt-5 pb-4">
              <div>
                <h2 id="heute" className="text-title-sm font-title tracking-title">{t.today}</h2>
                <p className="text-meta text-muted mt-0.5">{added.length === 0 ? t.nothing : t.newest}</p>
              </div>
              <span className="text-display font-title tracking-display leading-none tnum">{added.length}</span>
            </div>
            {added.length === 0 ? (
              <div className="px-5 pb-6 flex items-end gap-4 border-t border-line pt-5">
                <div aria-hidden className="flex items-end gap-1.5 flex-none">
                  {[0, 1, 2].map((i) => <span key={i} className="block w-[28px] h-[42px] rounded-xs border border-dashed border-line-strong" />)}
                </div>
                <p className="text-ink-2 text-body-sm leading-snug">{t.firstHint}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line max-h-[56vh] overflow-y-auto">
                {added.map((a) => (
                  <li key={a.id} className={cx("flex items-center gap-3.5 px-5 py-3", a.id === fresh && "anim-flash")}>
                    <Cover data={a.cover} width={36} height={54} uniform l={l} />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lead leading-tight truncate">{a.title}</p>
                      <p className="text-meta text-muted truncate mt-0.5">
                        {labels(l).conditionLabel[a.condition]}{a.circlesOnly ? t.circlesOnly : ""}{a.authors[0] ? ` · ${a.authors[0]}` : ""}
                      </p>
                    </div>
                    <Link href={`/regal/${a.id}`} className="text-meta font-medium text-accent-hover hover:underline underline-offset-4 flex-none py-2">{t.edit}</Link>
                  </li>
                ))}
              </ul>
            )}
            {added.length > 0 && (
              <div className="px-5 py-4 border-t border-line">
                <LinkButton href="/regal" variant="secondary" className="w-full">{t.toShelf} <IconArrowRight width={16} height={16} /></LinkButton>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

