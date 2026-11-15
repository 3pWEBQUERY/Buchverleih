"use client";
import Link from "next/link";
import { useState } from "react";
import { api, uploadPhoto } from "@/lib/client";
import type { LoanView } from "@/lib/loans/queries";
import { caseResponseLabel } from "@/lib/i18n/de-CH";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { STEPS } from "@/lib/i18n/messages/loans-steps";
import { addDays, dayToDate, fmtDay } from "@/lib/dates";
import { Button, Check, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

/**
 * Teilformulare des nächsten Schritts – je Zustand eine Komponente: Annehmen, Zustand festhalten,
 * Schaden melden, Übergabe melden, Bewerten, auf einen Fall antworten, Zeitraum verschieben.
 */
const radioCard = "flex items-center gap-3 min-h-14 px-4 py-3 rounded-md bg-paper border border-line cursor-pointer hover:border-ink-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/35 transition-colors";

export function AcceptForm({ loan, busy, onAccept, onDecline }: { loan: LoanView; busy: boolean; onAccept: (b: Record<string, unknown>) => void; onDecline: () => void }) {
  const [spot, setSpot] = useState(loan.ownerSpots[0]?.id ?? "");
  const [when, setWhen] = useState("");
  const [swapCopy, setSwapCopy] = useState(loan.swapOffered[0]?.id ?? "");
  const m = STEPS[useLocale()];
  const place = loan.ownerSpots.find((s) => s.id === spot)?.label ?? loan.circle?.fixed_spot ?? null;
  return (
    <div className="space-y-6 max-w-2xl">
      {loan.kind === "swap" && (
        <fieldset>
          <legend className="text-meta font-medium mb-2">{m.offeredBooks}</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {loan.swapOffered.map((o) => (
              <label key={o.id} className={radioCard}>
                <input type="radio" name="swap" checked={swapCopy === o.id} onChange={() => setSwapCopy(o.id)} className="accent-[var(--accent)] h-4 w-4 flex-none" />
                <span className="min-w-0">
                  <span className="block font-serif text-lead leading-tight truncate">{o.title}</span>
                  <span className="block text-meta text-muted truncate">{o.authors[0]}</span>
                </span>
              </label>
            ))}
          </div>
          <Link href={`/profil/${loan.other?.id}`} className="text-body-sm font-medium text-accent-hover hover:underline underline-offset-4 mt-3 inline-block">{m.wholeSwapShelf}</Link>
        </fieldset>
      )}
      <div className="grid md:grid-cols-2 gap-5 md:gap-4">
      {loan.ownerSpots.length > 0 ? (
        <Field label={m.spot} hint={m.spotHint}>
          <Select value={spot} onChange={setSpot}
            options={loan.ownerSpots.map((s) => ({ value: s.id, label: s.label, text: s.label, hint: s.dropoff ? m.dropoffPossible.replace(/^\s*[·(–-]\s*|\)$/g, "") : undefined }))} />
        </Field>
      ) : loan.circle?.fixed_spot ? (
        <div className="text-body"><span className="block text-meta font-medium mb-2">{m.circleSpot}</span><span className="flex items-center h-12 px-4 rounded-md bg-paper-2 border border-line">{loan.circle.fixed_spot}</span></div>
      ) : (
        <Notice className="self-end">{m.noSpot[0]}<Link href="/einstellungen#uebergabeorte" className="underline underline-offset-4">{m.noSpot[1]}</Link>{m.noSpot[2]}</Notice>
      )}
      <Field label={m.proposal} hint={m.proposalHint}>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <Button variant="primary" size="lg" disabled={busy || (loan.kind === "swap" && !swapCopy)}
          onClick={() => onAccept({ pickupSpotId: spot || null, proposalAt: when ? new Date(when).toISOString() : null, proposalPlace: when ? place : null, swapCopyId: loan.kind === "swap" ? swapCopy : null })}>
          {m.accept}
        </Button>
        <Button variant="quiet" onClick={onDecline}>{m.decline}</Button>
      </div>
    </div>
  );
}

function PhotoPicker({ loanId, purpose, keys, setKeys, max = 6 }: { loanId: string; purpose: string; keys: string[]; setKeys: (k: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const m = STEPS[useLocale()];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {keys.map((k) => (
         
        <img key={k} src={`/api/v1/images/${k}?w=480`} alt={m.uploadedPhoto} className="h-20 w-20 object-cover rounded-md outline outline-1 -outline-offset-1 outline-black/10 anim-pop" />
      ))}
      {keys.length < max && (
        <label className={cx("h-20 px-5 grid place-items-center border border-dashed border-field rounded-md bg-paper text-body-sm font-medium cursor-pointer hover:border-accent hover:text-accent-hover transition-colors", busy && "opacity-50")}>
          {busy ? m.loading : m.addPhoto}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try { const r = await uploadPhoto(f, purpose, loanId); setKeys([...keys, r.key]); }
              catch (err) { toast.error((err as Error).message); }
              finally { setBusy(false); e.target.value = ""; }
            }} />
        </label>
      )}
    </div>
  );
}

export function ConditionForm({ loanId, busy, onSubmit, onSkip, skipped }: { loanId: string; busy: boolean; onSubmit: (note: string, keys: string[]) => void; onSkip: () => void; skipped: boolean }) {
  const [note, setNote] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const m = STEPS[useLocale()];
  if (skipped) return <p className="text-muted">{m.skipped}</p>;
  return (
    <div className="space-y-4 max-w-xl">
      <Textarea aria-label={m.describeCondition} value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.conditionPlaceholder} maxLength={500} />
      <PhotoPicker loanId={loanId} purpose="condition" keys={keys} setKeys={setKeys} />
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" size="lg" disabled={busy || (!note.trim() && !keys.length)} onClick={() => onSubmit(note, keys)}>{m.saveCondition}</Button>
        <Button variant="quiet" onClick={onSkip}>{m.noDefects}</Button>
      </div>
    </div>
  );
}

export function DamageForm({ loan, busy, onSubmit }: { loan: LoanView; busy: boolean; onSubmit: (d: string, keys: string[]) => void }) {
  const [d, setD] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const m = STEPS[useLocale()];
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl">
      <p className="text-body text-ink-2">{m.damageIntro(Boolean(loan.conditionNote))}<Link href="/hilfe#schaden" className="underline underline-offset-4">{m.examples}</Link></p>
      <Textarea aria-label={m.describeDamage} value={d} onChange={(e) => setD(e.target.value)} placeholder={m.damagePlaceholder} maxLength={1000} />
      <PhotoPicker loanId={loan.id} purpose="case" keys={keys} setKeys={setKeys} />
      <Button variant="secondary" disabled={busy || d.trim().length < 5 || keys.length === 0} onClick={() => onSubmit(d, keys)}>{m.reportDamage}</Button>
      {keys.length === 0 && <p className="text-body-sm text-muted">{m.photoNeeded}</p>}
    </div>
  );
}

export function ReportHandover({ loan, busy, onReport }: { loan: LoanView; busy: boolean; onReport: (photoKey: string | null) => void }) {
  const [mode, setMode] = useState<"report" | "dropoff">("report");
  const [keys, setKeys] = useState<string[]>([]);
  const dropoff = loan.role === "owner" && loan.copySettings.dropoff_allowed;
  const m = STEPS[useLocale()];
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl">
      {dropoff && (
        <div className="grid sm:grid-cols-2 gap-2 text-body">
          <label className={radioCard}><input type="radio" checked={mode === "report"} onChange={() => setMode("report")} className="accent-[var(--ink)] h-4 w-4" /> {m.inPerson}</label>
          <label className={radioCard}><input type="radio" checked={mode === "dropoff"} onChange={() => setMode("dropoff")} className="accent-[var(--ink)] h-4 w-4" /> {m.inDropoff}</label>
        </div>
      )}
      <p className="text-body text-ink-2">{mode === "dropoff" ? m.dropoffText : m.reportText}</p>
      {mode === "dropoff" && <PhotoPicker loanId={loan.id} purpose="dropoff" keys={keys} setKeys={setKeys} max={1} />}
      <Button variant="secondary" disabled={busy || (mode === "dropoff" && !keys.length)} onClick={() => onReport(mode === "dropoff" ? keys[0] : null)}>{m.reportHandover}</Button>
    </div>
  );
}

export function RateForm({ busy, onRate }: { busy: boolean; onRate: (v: "good" | "problems", reasons: string[], note?: string) => void }) {
  const [problems, setProblems] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const l = useLocale();
  const m = STEPS[l];
  if (!problems) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => onRate("good", [])}>{m.gladly}</Button>
        <Button variant="secondary" size="lg" onClick={() => setProblems(true)}>{m.problems}</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4 max-w-xl anim-rise">
      <div className="flex flex-wrap gap-2">
        {Object.entries(labels(l).ratingReasonLabel).map(([k, label]) => (
          <Check key={k} label={label} checked={reasons.includes(k)} onChange={(v) => setReasons((r) => (v ? [...r, k] : r.filter((x) => x !== k)))}
            className="min-h-11 pl-3 pr-4 rounded-sm bg-paper border border-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/35 transition-colors" />
        ))}
      </div>
      <Textarea aria-label={m.toModeration} value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.whatHappened} maxLength={500} />
      <div className="flex gap-4 items-center">
        <Button variant="primary" disabled={busy || reasons.length === 0} onClick={() => onRate("problems", reasons, note || undefined)}>{m.send}</Button>
        <Button variant="quiet" onClick={() => setProblems(false)}>{m.back}</Button>
      </div>
    </div>
  );
}

export function CaseResponse({ loan, onDone }: { loan: LoanView; onDone: () => void }) {
  const toast = useToast();
  const l = useLocale();
  const m = STEPS[l];
  const damage = loan.case?.kind === "damage";
  const options = (damage ? ["replace_same", "replace_other", "object"] : ["return_date", "replace_same", "replace_other", "swap_offer"]) as (keyof typeof caseResponseLabel)[];
  const [choice, setChoice] = useState<keyof typeof caseResponseLabel>(options[0]);
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState(addDays(new Date().toISOString().slice(0, 10), 2));
  const [swapCopy, setSwapCopy] = useState(loan.myOfferable[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4 max-w-xl">
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o} className={cx(radioCard, "text-body")}>
            <input type="radio" name="case" checked={choice === o} onChange={() => setChoice(o)} className="accent-[var(--accent)] h-4 w-4 flex-none" />
            {labels(l).caseResponseLabel[o]}
          </label>
        ))}
      </div>
      {choice === "return_date" && <Field label={m.returnOn}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-52" /></Field>}
      {choice === "swap_offer" && (
        <Field label={m.yourBook}>
          <Select value={swapCopy} onChange={setSwapCopy}
            options={loan.myOfferable.map((o) => ({ value: o.id, label: <span className="font-serif">{o.title}</span>, text: o.title }))} />
        </Field>
      )}
      <Textarea aria-label={m.caseReply} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={choice === "object" ? m.objectPlaceholder : m.addition} maxLength={500} />
      <Button variant="primary" size="lg" disabled={busy || (choice === "swap_offer" && !swapCopy)} onClick={async () => {
        setBusy(true);
        try {
          await api(`/cases/${loan.case!.id}`, { body: { action: "respond", response: choice, detail: detail || undefined, returnAt: choice === "return_date" ? new Date(`${date}T18:00:00`).toISOString() : undefined, swapCopyId: choice === "swap_offer" ? swapCopy : undefined } });
          toast.show({ text: m.answerSent });
          onDone();
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }}>{m.answer}</Button>
    </div>
  );
}

export function Reschedule({ loan, busy, onSubmit, onCancelFree }: { loan: LoanView; busy: boolean; onSubmit: (s: string, e: string) => void; onCancelFree: () => void }) {
  const [start, setStart] = useState(loan.wanted!.start);
  const l = useLocale();
  const m = STEPS[l];
  const [days, setDays] = useState(Math.max(1, Math.round((dayToDate(loan.wanted!.end!).getTime() - dayToDate(loan.wanted!.start).getTime()) / 86400_000)));
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl">
      <p className="text-body text-ink-2">{m.rescheduleText}</p>
      <div className="flex flex-wrap gap-4 items-end">
        <Field label={m.start}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-48" /></Field>
        <Field label={m.days}><Input type="number" min={1} max={loan.copySettings.loan_days} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} className="w-24" /></Field>
        <Button variant="secondary" disabled={busy} onClick={() => onSubmit(start, addDays(start, days))}>{m.apply}</Button>
      </div>
      <p className="text-body-sm text-muted">{m.until(fmtDay(dayToDate(addDays(start, days - 1)), l))}</p>
      <Button variant="quiet" onClick={onCancelFree}>{m.cancelFree}</Button>
    </div>
  );
}
