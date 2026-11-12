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
import { Button, Input, LinkButton, cx } from "@/components/ui";
import { IconArrowRight, IconScan, IconSearch } from "@/components/icons";
import { LookupSkeleton, ManualTab, PendingCard, SearchTab, coverOf } from "./erfassen-parts";

export type Added = { id: string; title: string; authors: string[]; condition: number; circlesOnly: boolean; cover: CoverData };
type Tab = "scan" | "search" | "manual";

const IconPen = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  </svg>
);

const TABS: { id: Tab; icon: React.ReactNode }[] = [
  { id: "scan", icon: <IconScan /> },
  { id: "search", icon: <IconSearch /> },
  { id: "manual", icon: <IconPen /> },
];
const ASKED_KEY = "lr_precious_asked";

export function Erfassen({ initial }: { initial: Added[] }) {
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
    const r = await api<{ id: string }>("/copies", { body: { editionId: edition.id, condition, ...(precious ? { precious: true } : {}) } });
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

  const done = async (cond: number, precious: boolean) => {
    if (!pending) return;
    await add(pending, cond, precious);
    setPending(null);
  };

  return (
    <div>
      <header className="anim-rise">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h1>
        <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-2xl">
          {t.lead}
        </p>
      </header>

      <div className="mt-10 md:mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-x-10 xl:gap-x-16 gap-y-12 items-start">
        <div className="min-w-0">
          {/* 01 – Weg wählen */}
          <StepSection n={1} first title={t.step1}>
            <div role="radiogroup" aria-label={t.step1Aria} className="grid grid-cols-3 gap-2 sm:gap-3">
              {TABS.map((x) => (
                <OptionCard key={x.id} on={tab === x.id} onClick={() => switchTab(x.id)} icon={x.icon} title={t.tabs[x.id][0]} desc={t.tabs[x.id][1]} descDesktopOnly />
              ))}
            </div>
          </StepSection>

          {/* 02 – Buch finden */}
          <StepSection id="finden" n={2} title={t.step2[tab][0]} desc={t.step2[tab][1]}>
            {tab === "scan" && (
              <div className="space-y-4">
                <div className="rounded-[12px] border border-line bg-paper-2 p-2.5 md:p-3">
                  <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2.5">
                    <p className="text-[12.5px] font-medium text-ink-2 flex items-center gap-2">
                      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", noCamera ? "bg-done" : pending || looking ? "bg-wait" : "bg-accent live-dot")} />
                      {noCamera ? t.cam.none : looking ? t.cam.looking : pending ? t.cam.paused : t.cam.ready}
                    </p>
                    <p className="text-[12.5px] text-muted hidden sm:block">{t.ean}</p>
                  </div>
                  <div className={cx("overflow-hidden rounded-[8px] transition-[max-height] duration-300 ease-[var(--ease-out-quart)]", pending || looking ? "max-h-32" : "max-h-[70vh]")}>
                    <Scanner mode="isbn" continuous paused={Boolean(pending || looking)} onResult={lookup} fallbackHint={t.fallback} className="!rounded-[8px] bg-paper" onUnavailable={() => setNoCamera(true)} />
                  </div>
                </div>

                {!pending && !looking && (
                  <form className="rounded-[10px] border border-line p-4 md:p-5" onSubmit={(e) => { e.preventDefault(); if (manualIsbn.trim()) lookup(manualIsbn); }}>
                    <label htmlFor="isbn-hand" className="font-medium text-[15px] block">{t.isbnHand}</label>
                    <p className="text-[13px] text-muted mt-0.5 mb-3">{t.isbnHandHint}</p>
                    <div className="flex gap-2">
                      <Input id="isbn-hand" className="flex-1 min-w-0" value={manualIsbn} onChange={(e) => setManualIsbn(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="978 3 15 009152 1" />
                      <Button type="submit" variant="secondary" className="h-12 flex-none" disabled={manualIsbn.replace(/\D/g, "").length < 10}>{t.lookup}</Button>
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
              <StepSection n={3} title={t.step3} desc={t.step3Desc}>
                {looking ? <LookupSkeleton isbn={looking} />
                  : pending ? <PendingCard key={pending.id} edition={pending} ask={!asked} onAsked={markAsked} onCancel={() => setPending(null)} onDone={done} />
                  : (
                    <div className="rounded-[10px] border border-dashed border-line-strong px-5 py-6 text-[15px] text-muted">
                      {tab === "scan" ? t.waitScan : t.waitPick}
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
                <h2 id="heute" className="text-[19px] font-[560] tracking-[-0.025em]">{t.today}</h2>
                <p className="text-[13px] text-muted mt-0.5">{added.length === 0 ? t.nothing : t.newest}</p>
              </div>
              <span className="text-[34px] font-[560] tracking-[-0.04em] leading-none tnum">{added.length}</span>
            </div>
            {added.length === 0 ? (
              <div className="px-5 pb-6 flex items-end gap-4 border-t border-line pt-5">
                <div aria-hidden className="flex items-end gap-1.5 flex-none">
                  {[0, 1, 2].map((i) => <span key={i} className="block w-[28px] h-[42px] rounded-[3px] border border-dashed border-line-strong" />)}
                </div>
                <p className="text-ink-2 text-[14px] leading-snug">{t.firstHint}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line max-h-[56vh] overflow-y-auto">
                {added.map((a) => (
                  <li key={a.id} className={cx("flex items-center gap-3.5 px-5 py-3", a.id === fresh && "anim-flash")}>
                    <Cover data={a.cover} width={36} height={54} uniform l={l} />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[16.5px] leading-tight truncate">{a.title}</p>
                      <p className="text-[12.5px] text-muted truncate mt-0.5">
                        {labels(l).conditionLabel[a.condition]}{a.circlesOnly ? t.circlesOnly : ""}{a.authors[0] ? ` · ${a.authors[0]}` : ""}
                      </p>
                    </div>
                    <Link href={`/regal/${a.id}`} className="text-[13px] font-medium text-accent-hover hover:underline underline-offset-4 flex-none py-2">{t.edit}</Link>
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

