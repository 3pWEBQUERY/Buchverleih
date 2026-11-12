"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Calendar } from "@/lib/loans/calendar";
import { fitsFree } from "@/lib/loans/calendar";
import { addDays, dayToDate, diffDays, fmtDay } from "@/lib/dates";
import type { OfferKind } from "@/lib/loans/machine";
import { CalendarView } from "@/components/calendar";
import { OptionCard, Stepper } from "@/components/form-controls";
import { Button, Input, LinkButton, Notice, Textarea, cx } from "@/components/ui";
import { IconBookmark, IconLoans, IconSwap } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { EXEMPLAR } from "@/lib/i18n/messages/exemplar";

/**
 * Anfrage (PRD 4.2, 4.8, 5): Eine Anfrage ist immer eine Anfrage für einen Zeitraum.
 * «Ab heute» ist nur der häufigste Fall. Freie Zeiträume im Kalender sind antippbar.
 * Unten läuft eine Zusammenfassung mit dem einzigen Akzent-Knopf mit.
 */
export function RequestPanel({
  copyId, offers, calendar, loggedIn, blocker, paused, myOffers, loanDays, title,
}: {
  copyId: string; offers: OfferKind[]; calendar: Calendar; loggedIn: boolean; blocker: string | null; paused: boolean;
  myOffers: { id: string; title: string }[]; loanDays: number; title: string;
}) {
  const router = useRouter();
  const l = useLocale();
  const t = EXEMPLAR[l].req;
  const [kind, setKind] = useState<OfferKind>(offers[0] ?? "lend");
  const firstFree = calendar.free[0];
  const [start, setStart] = useState(firstFree?.start ?? calendar.today);
  const [days, setDays] = useState(loanDays);
  const [message, setMessage] = useState("");
  const [swapIds, setSwapIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const slot = calendar.free.find((f) => f.start <= start && start < f.end);
  const maxDays = slot ? Math.max(1, Math.min(loanDays, diffDays(start, slot.end))) : loanDays;
  const d = Math.min(days, maxDays);
  const end = addDays(start, d);
  const fits = useMemo(() => fitsFree(calendar.free, start, end), [calendar.free, start, end]);
  const tooFar = diffDays(calendar.today, start) > diffDays(calendar.today, calendar.horizonEnd) - 1;
  const freeNow = calendar.free.some((f) => f.start === calendar.today);
  const ok = fits && !tooFar;

  if (!offers.length) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === "lend"
          ? { copyId, kind, start, end, message: message || undefined }
          : kind === "swap"
            ? { copyId, kind, swapOfferedCopyIds: swapIds, message: message || undefined }
            : { copyId, kind, message: message || undefined };
      const r = await api<{ id: string }>("/loans", { body });
      router.push(`/vorgaenge/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  let n = 0;
  const step = () => ++n;
  const canSend = loggedIn && !blocker && !paused && !busy && (kind !== "lend" || ok) && (kind !== "swap" || swapIds.length > 0);

  return (
    <div className="mt-2" aria-label={t.aria}>
      {offers.length > 1 && (
        <Section n={step()} title={t.what}>
          <div role="radiogroup" aria-label={t.what} className="grid sm:grid-cols-3 gap-3">
            {offers.map((o) => (
              <OptionCard key={o} on={kind === o} onClick={() => setKind(o)}
                icon={o === "lend" ? <IconLoans /> : o === "swap" ? <IconSwap /> : <IconBookmark />}
                title={o === "lend" ? t.lend : o === "swap" ? t.swap : t.gift}
                desc={o === "lend" ? t.lendDesc(loanDays) : o === "swap" ? t.swapDesc : t.giftDesc} />
            ))}
          </div>
        </Section>
      )}

      {kind === "lend" && (
        <Section n={step()} title={t.period} desc={freeNow ? t.freeNowDesc : t.busyDesc(firstFree ? fmtDay(dayToDate(firstFree.start), l) : "–")}>
          <div className="rounded-[10px] border border-line p-5 md:p-6">
            <CalendarView cal={calendar} selection={{ start, end, ok }} onPick={(s, dd) => { setStart(dd); setDays(Math.min(loanDays, diffDays(dd, s.end))); }} />
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-line p-4">
              <label htmlFor="beginn" className="font-medium text-[15px] block">{t.start}</label>
              <p className="text-[13px] text-muted mt-0.5 mb-3">{t.startHint(diffDays(calendar.today, calendar.horizonEnd) - 1)}</p>
              <Input id="beginn" type="date" value={start} min={calendar.today} max={addDays(calendar.horizonEnd, -1)} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </div>
            <div className="rounded-[10px] border border-line p-4">
              <p className="font-medium text-[15px]">{t.duration}</p>
              <p className="text-[13px] text-muted mt-0.5 mb-3">{t.durationHint(maxDays)}</p>
              <Stepper value={d} min={1} max={maxDays} format={(x) => t.dayN(x)} onChange={setDays} label={t.duration} full />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[7, 14, 21, maxDays].filter((x, i, a) => x <= maxDays && a.indexOf(x) === i).map((x) => (
                  <button key={x} type="button" onClick={() => setDays(x)}
                    className={cx("h-8 px-3 rounded-[6px] border text-[13px] font-medium transition-colors", d === x ? "border-accent bg-accent-soft/35 text-accent-hover" : "border-line hover:border-ink-2 text-ink-2")}>
                    {x === maxDays && x !== 7 && x !== 14 && x !== 21 ? t.max : t.weeks(x / 7)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {kind === "swap" && (
        <Section n={step()} title={t.swapTitle} desc={t.swapDescLong}>
          {myOffers.length === 0 ? (
            <Notice>{t.noSwap} <Link href="/regal" className="underline underline-offset-4">{t.markInShelf}</Link></Notice>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {myOffers.map((o) => {
                const on = swapIds.includes(o.id);
                return (
                  <OptionCard key={o.id} multi compact on={on} title={o.title}
                    onClick={() => setSwapIds((s) => (on ? s.filter((x) => x !== o.id) : s.length < 5 ? [...s, o.id] : s))} />
                );
              })}
            </div>
          )}
        </Section>
      )}

      {kind === "gift" && (
        <Section n={step()} title={t.giftTitle} desc={t.giftDescLong}>
          <></>
        </Section>
      )}

      <Section n={step()} title={t.message} desc={t.messageDesc}>
        <Textarea aria-label={t.messageAria} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.messagePlaceholder(title)} />
      </Section>

      {/* Zusammenfassung mit dem einzigen Akzent-Knopf */}
      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 z-20 mt-10 anim-rise">
        <div className="rounded-[12px] border border-line-strong bg-paper/95 backdrop-blur-md p-3 pl-4 md:p-5 flex items-center justify-between gap-3 md:gap-4">
          <div className="min-w-0" aria-live="polite">
            {kind === "lend" ? (
              ok ? (
                <>
                  <p className="hidden md:block text-[13px] text-muted">{t.yourRequest}</p>
                  <p className="text-[14.5px] md:text-[19px] font-[560] tracking-[-0.02em] tnum leading-snug">
                    {fmtDay(dayToDate(start), l)} – {fmtDay(dayToDate(addDays(end, -1)), l)} <span className="text-muted font-normal text-[13px] md:text-[15px] whitespace-nowrap">· {t.dayN(d)}</span>
                  </p>
                </>
              ) : (
                <p className="text-late text-[13.5px] md:text-[14.5px] leading-snug max-w-md">{tooFar ? t.tooFar : t.taken}</p>
              )
            ) : kind === "swap" ? (
              <>
                <p className="text-[13px] text-muted">{t.yourRequest}</p>
                <p className="text-[17px] font-[560] tracking-[-0.02em]">{swapIds.length === 0 ? t.pickOne : t.swapSummary(swapIds.length)}</p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted">{t.yourRequest}</p>
                <p className="text-[17px] font-[560] tracking-[-0.02em]">{t.gift2}</p>
              </>
            )}
            <p className="hidden md:block text-[12.5px] text-muted mt-0.5">{t.within72}</p>
          </div>
          {!loggedIn ? (
            <LinkButton href={`/anmelden?next=/exemplar/${copyId}`} variant="primary" size="lg">{t.login}</LinkButton>
          ) : (
            <Button variant="primary" size="lg" className="flex-none !px-4 md:!px-6" onClick={submit} disabled={!canSend}>
              {busy ? t.sending : kind === "swap" ? t.askSwap : <><span className="md:hidden">{t.askShort}</span><span className="hidden md:inline">{t.askLong}</span></>}
            </Button>
          )}
        </div>
        {paused && <Notice className="mt-3">{t.paused}</Notice>}
        {blocker && <Notice tone="accent" className="mt-3">{blocker} <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4">{t.toSettings}</Link></Notice>}
        {error && <p className="text-late mt-3" role="alert">{error}</p>}
      </div>
    </div>
  );
}

function Section({ n, title, desc, children }: { n: number; title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-10 md:pt-12 mt-10 md:mt-12 border-t border-line" aria-label={title}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-6">
        <span className="text-[13px] tnum text-muted pt-1.5">0{n}</span>
        <div>
          <h3 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">{title}</h3>
          {desc && <p className="text-[15px] text-muted mt-1.5 max-w-2xl">{desc}</p>}
        </div>
      </div>
      <div className="md:pl-[72px]">{children}</div>
    </section>
  );
}
