"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, uploadPhoto } from "@/lib/client";
import type { LoanView } from "@/lib/loans/queries";
import { caseResponseLabel } from "@/lib/i18n/de-CH";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { STEPS } from "@/lib/i18n/messages/loans-steps";
import { addDays, dayToDate, deadline, dueDay, fmtDay, relHours } from "@/lib/dates";
import { Button, Check, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { HandoverCode } from "./handover-code";
import { ScanOverlay } from "./scan-overlay";

/**
 * Der nächste Schritt: genau ein hervorgehobener Knopf (PRD 8.3). Alles andere ist sekundär
 * und steht darunter als ruhige Links.
 */
export function NextStep({ loan, me }: { loan: LoanView; me: string }) {
  const router = useRouter();
  const toast = useToast();
  const l = useLocale();
  const m = STEPS[l];
  const L = labels(l);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<null | { kind: "code" | "scan"; label: string; loanId?: string }>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const owner = loan.role === "owner";

  const refresh = useCallback(() => router.refresh(), [router]);

  async function act(body: Record<string, unknown>, done?: string, loanId = loan.id) {
    setBusy(true);
    try {
      await api(`/loans/${loanId}/actions`, { body });
      if (done) toast.show({ text: done });
      setPanel(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Nicht umkehrbare Wechsel werden kurz verzögert und lassen sich bis dahin rückgängig machen. */
  function deferred(text: string, body: Record<string, unknown>) {
    toast.deferred(text, async () => {
      await api(`/loans/${loan.id}/actions`, { body });
      refresh();
    });
  }

  const step = loan.step;
  const t = loan.times;
  const passOnNext = loan.nextLoan?.received_from_loan_id === loan.id ? loan.nextLoan : null;
  const passOnAskPrev = !owner && loan.nextLoan && loan.nextLoan.pass_on_owner_ok === true && loan.nextLoan.pass_on_prev_ok == null && !loan.nextLoan.received_from_loan_id;

  // ---------------------------------------------------------------- Hauptbereich
  let main: React.ReactNode = null;
  let context: React.ReactNode = null;

  if (passOnNext && loan.status === "active" && !owner) {
    context = <>{m.passOnTo[0]}<strong className="font-medium">{passOnNext.borrower_name}</strong>{m.passOnTo[1]}</>;
    main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: m.passOnCode, loanId: passOnNext.id })}>{m.passOnShow}</Button>;
  } else if (passOnAskPrev) {
    context = m.passOnAsk(loan.nextLoan!.borrower_name, fmtDay(dayToDate(loan.nextLoan!.start), l));
    main = (
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: true }, m.agreed, loan.nextLoan!.id)}>{m.yesPassOn}</Button>
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: false }, m.viaOwnerDone, loan.nextLoan!.id)}>{m.viaOwner}</Button>
      </div>
    );
  } else if (step) {
    switch (step.key) {
      case "respond":
        context = loan.kind === "swap" ? m.respondSwap : m.respondLend;
        main = <AcceptForm loan={loan} busy={busy} onAccept={(b) => act({ action: "accept", ...b }, m.accepted)} onDecline={() => deferred(m.declined, { action: "decline" })} />;
        break;
      case "show_code":
        context = loan.kind === "swap" ? m.showCodeSwap : m.showCodeLend(loan.other?.first_name ?? "");
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: loan.kind === "swap" ? m.swapCode : m.handoverCode })}>{step.label}</Button>;
        break;
      case "scan_code":
        context = loan.kind === "swap" ? m.scanSwap : m.scanLend(loan.received_from_loan_id ? m.currentHolder : loan.other?.first_name ?? "");
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "scan", label: m.scanCode })}>{step.label}</Button>;
        break;
      case "confirm_handover":
        context = m.confirmHandover(loan.other?.first_name ?? "", loan.handoverMethod === "dropoff",
          t.handover_reported_at ? m.inRel(relHours(new Date(new Date(t.handover_reported_at).getTime() + 48 * 3600_000), l)) : m.after48);
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_handover" }, m.confirmed)}>{step.label}</Button>
            <Button variant="quiet" onClick={() => act({ action: "object_handover" }, m.objected)}>{m.nothingReceived}</Button>
          </div>
        );
        break;
      case "return_code":
        context = t.due_at ? m.returnCode(deadline(dueDay(t.due_at), m.returnBy, l), loan.other?.first_name ?? "") : m.showOnReturn;
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: m.returnCodeLabel })}>{step.label}</Button>;
        break;
      case "scan_return":
        context = t.due_at ? m.scanReturnCtx(loan.other?.first_name ?? "", deadline(dueDay(t.due_at), m.returnBy, l)) : null;
        main = <Button variant="secondary" size="lg" onClick={() => setOverlay({ kind: "scan", label: m.scanReturn })}>{step.label}</Button>;
        break;
      case "confirm_return":
        context = m.confirmReturn(loan.other?.first_name ?? "");
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_return" }, m.returnConfirmed)}>{step.label}</Button>
            <Button variant="quiet" onClick={() => act({ action: "object_return" }, m.objected)}>{m.notBack}</Button>
          </div>
        );
        break;
      case "inspect":
        context = m.inspect(t.inspection_until ? m.inRel(relHours(t.inspection_until, l)) : m.after48);
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "complete" }, m.completed)}>{step.label}</Button>
            <Button variant="quiet" onClick={() => setPanel(panel === "damage" ? null : "damage")}>{m.reportDamage}</Button>
          </div>
        );
        break;
      case "condition_note":
        context = m.conditionCtx(t.condition_note_until ? relHours(t.condition_note_until, l) : "", loan.handoverMethod === "pass_on");
        main = <ConditionForm loanId={loan.id} busy={busy} onSubmit={(note, photoKeys) => act({ action: "condition_note", note, photoKeys }, m.conditionSaved)} onSkip={() => setPanel("skip-cond")} skipped={panel === "skip-cond"} />;
        break;
      case "grant_extension":
        context = m.wantsLonger(loan.other?.first_name ?? "");
        main = <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "grant_extension" }, m.extended)}>{step.label}</Button>;
        break;
      case "accept_swap_offer":
        context = m.swapOfferCtx(loan.other?.first_name ?? "", loan.title, loan.swapOffer?.title ?? "");
        main = <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "accept_swap_offer" }, m.swapDone)}>{m.acceptSwap}</Button>;
        break;
      case "case_respond":
        context = loan.case?.kind === "damage" ? m.caseDamage : m.caseNonreturn;
        main = <CaseResponse loan={loan} onDone={refresh} />;
        break;
      case "case_resolve":
        context = <>{m.caseAnswer}{loan.case?.response ? L.caseResponseLabel[loan.case.response as keyof typeof caseResponseLabel] : ""}{loan.case?.response_detail ? ` – ${loan.case.response_detail}` : ""}</>;
        main = (
          <Button variant="primary" size="lg" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await api(`/cases/${loan.case!.id}`, { body: { action: "resolve", outcome: "replaced" } }); toast.show({ text: m.caseSolved }); refresh(); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{step.label}</Button>
        );
        break;
      case "rate":
        context = m.rateCtx;
        main = <RateForm busy={busy} onRate={(verdict, reasons, note) => act({ action: "rate", verdict, reasons, note }, m.thanks)} />;
        break;
      case "clear_loss":
        context = m.lossCtx;
        main = <Button variant="secondary" disabled={busy} onClick={() => act({ action: "clear_loss" }, m.lossCleared)}>{step.label}</Button>;
        break;
      case "pass_on_consent": {
        const p = loan.passOn;
        context = owner ? m.passOnOwner(loan.other?.first_name ?? "") : m.passOnNext;
        main = (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: true }, m.agreed)}>{m.yesPassOn}</Button>
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: false }, m.viaOwnerShort)}>{m.no}</Button>
            {p && <span className="text-sm text-muted self-center">{m.consents([p.owner, p.prev, p.next].filter(Boolean).length)}</span>}
          </div>
        );
        break;
      }
    }
  } else if (loan.waitingText) {
    context = loan.status === "requested" ? m.waitingAnswer(loan.other?.first_name ?? "", m.inRel(relHours(t.respond_by, l))) : loan.waitingText;
  }

  // ---------------------------------------------------------------- Sekundäre Handlungen
  const can = (a: string) => loan.actions.includes(a as never);
  const secondary: React.ReactNode[] = [];
  if (can("withdraw")) secondary.push(<Button key="w" variant="quiet" onClick={() => deferred(m.withdrawn, { action: "withdraw" })}>{m.withdraw}</Button>);
  if (can("cancel")) secondary.push(<Button key="c" variant="quiet" onClick={() => deferred(m.cancelled, { action: "cancel" })}>{m.cancel}</Button>);
  if (loan.status === "accepted" && !loan.handoverReportedBy && loan.kind !== "swap" && !loan.received_from_loan_id) {
    secondary.push(<Button key="rh" variant="quiet" onClick={() => setPanel(panel === "report" ? null : "report")}>{m.reportHandoverBtn}</Button>);
  }
  if (loan.status === "active" && !owner) {
    if (!loan.extensionRequested && loan.extensionsUsed < loan.copySettings.max_extensions && !t.recalled_at)
      secondary.push(<Button key="e" variant="quiet" disabled={busy} onClick={() => act({ action: "extend" }, loan.copySettings.auto_extend ? m.extended : m.extensionAsked)}>{loan.copySettings.auto_extend ? m.extendAuto : m.extendAsk}</Button>);
    secondary.push(<Button key="rr" variant="quiet" onClick={() => act({ action: "report_return" }, m.returnReported)}>{m.reportReturnBtn}</Button>);
    if (loan.myOfferable.length) secondary.push(<Button key="os" variant="quiet" onClick={() => setPanel(panel === "swap" ? null : "swap")}>{m.offerSwapBtn}</Button>);
  }
  if (loan.status === "active" && owner) {
    if (!t.recalled_at && t.handed_over_at && Date.now() - new Date(t.handed_over_at).getTime() > 14 * 86400_000)
      secondary.push(<Button key="rc" variant="quiet" onClick={() => deferred(m.recalled, { action: "recall" })}>{m.recall}</Button>);
    if (t.due_at && new Date(t.due_at) < new Date(Date.now() - 3 * 86400_000))
      secondary.push(<Button key="oc" variant="quiet" onClick={() => act({ action: "open_case" }, m.caseOpened)}>{m.openCase}</Button>);
    if (step?.key !== "scan_return") secondary.push(<Button key="ro" variant="quiet" onClick={() => setOverlay({ kind: "scan", label: m.scanReturn })}>{m.scanReturn}</Button>);
  }
  if (loan.status === "accepted" && !owner && loan.kind === "lend" && loan.wanted && loan.wanted.start > new Date().toISOString().slice(0, 10)) {
    secondary.push(<Button key="rs" variant="quiet" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>{m.reschedule}</Button>);
  }

  // ---------------------------------------------------------------- Kopf des Panels
  const passOn = Boolean((passOnNext && loan.status === "active" && !owner) || passOnAskPrev);
  const myTurn = passOn || Boolean(step && loan.turn === "me");
  const heading = passOnNext && loan.status === "active" && !owner ? m.passOnShow
    : passOnAskPrev ? m.passOnAskTitle
    : step && loan.turn === "me" ? step.label
    : loan.waitingText ?? step?.label ?? null;
  const eyebrow = myTurn ? m.yourTurn
    : loan.turn === "done" ? m.done
    : loan.turn === "system" ? m.moderation
    : m.turnOf(loan.other?.first_name ?? m.otherSide);

  if (!heading && !context && !main && secondary.length === 0) {
    return null;
  }

  return (
    <section aria-label={m.aria} className={cx(
      "anim-rise rounded-[12px]",
      myTurn ? "bg-paper-2 px-5 py-6 md:p-8" : "border border-line px-5 py-6 md:px-8 md:py-7",
    )}>
      <p className="eyebrow flex items-center gap-2">
        <span aria-hidden className={cx("h-2 w-2 rounded-full", myTurn ? "bg-accent live-dot" : loan.turn === "done" ? "bg-done" : "bg-wait")} />
        {eyebrow}
      </p>
      {heading && (
        <h2 className={cx("mt-2.5 font-[560] tracking-[-0.035em] leading-[1.05]", myTurn ? "text-[30px] md:text-[40px]" : "text-[24px] md:text-[30px]")}>{heading}</h2>
      )}
      {context && <p className={cx("text-[16px] md:text-[17px] leading-relaxed text-ink-2 max-w-2xl", heading ? "mt-3" : "")}>{context}</p>}
      {main && <div className="mt-7">{main}</div>}
      {secondary.length > 0 && (
        <div className={cx("flex flex-wrap items-center gap-x-6 gap-y-1 mt-7 pt-4 border-t", myTurn ? "border-line-strong/60" : "border-line")}>
          <span className="text-[12.5px] text-muted mr-1">{m.more}</span>
          {secondary.map((b, i) => <span key={i} className="inline-flex min-h-11 items-center">{b}</span>)}
        </div>
      )}

      {panel === "report" && (
        <ReportHandover loan={loan} busy={busy} onReport={(dropoffPhotoKey) => act({ action: "report_handover", dropoffPhotoKey }, m.handoverReported)} />
      )}
      {panel === "damage" && <DamageForm loan={loan} busy={busy} onSubmit={(description, photoKeys) => act({ action: "report_damage", description, photoKeys }, m.damageReported)} />}
      {panel === "swap" && (
        <div className="mt-6 border-t border-line pt-5 max-w-md anim-rise">
          <Field label={m.whichBook}>
            <Select defaultValue="" onChange={(e) => e.target.value && act({ action: "offer_swap", copyId: e.target.value }, m.swapOffered)}>
              <option value="" disabled>{m.chooseBook}</option>
              {loan.myOfferable.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </Field>
        </div>
      )}
      {panel === "reschedule" && loan.wanted && <Reschedule loan={loan} busy={busy} onSubmit={(start, end) => act({ action: "reschedule", start, end }, m.rescheduled)} onCancelFree={() => act({ action: "cancel_without_penalty" }, m.cancelled)} />}

      <Portal>
      {overlay?.kind === "code" && (
        <HandoverCode loanId={overlay.loanId ?? loan.id} label={overlay.label} onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); toast.show({ text: m.scanned }); refresh(); }} />
      )}
      {overlay?.kind === "scan" && (
        <ScanOverlay loanId={loan.id} label={overlay.label} onClose={() => setOverlay(null)}
          onDone={(r) => { setOverlay(null); toast.show({ text: r.waitingForOther ? m.scannedShowYours : m.confirmed }); refresh(); }} />
      )}
      </Portal>
    </section>
  );
}

/** Überlagerungen ausserhalb animierter Container rendern (transform erzeugt sonst einen eigenen Bezugsrahmen) */
function Portal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}

// ---------------------------------------------------------------- Teilformulare

const radioCard = "flex items-center gap-3 min-h-14 px-4 py-3 rounded-[10px] bg-paper border border-line cursor-pointer hover:border-ink-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/35 transition-colors";

function AcceptForm({ loan, busy, onAccept, onDecline }: { loan: LoanView; busy: boolean; onAccept: (b: Record<string, unknown>) => void; onDecline: () => void }) {
  const [spot, setSpot] = useState(loan.ownerSpots[0]?.id ?? "");
  const [when, setWhen] = useState("");
  const [swapCopy, setSwapCopy] = useState(loan.swapOffered[0]?.id ?? "");
  const m = STEPS[useLocale()];
  const place = loan.ownerSpots.find((s) => s.id === spot)?.label ?? loan.circle?.fixed_spot ?? null;
  return (
    <div className="space-y-6 max-w-2xl">
      {loan.kind === "swap" && (
        <fieldset>
          <legend className="text-[13px] font-medium mb-2">{m.offeredBooks}</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {loan.swapOffered.map((o) => (
              <label key={o.id} className={radioCard}>
                <input type="radio" name="swap" checked={swapCopy === o.id} onChange={() => setSwapCopy(o.id)} className="accent-[var(--accent)] h-4 w-4 flex-none" />
                <span className="min-w-0">
                  <span className="block font-serif text-[17px] leading-tight truncate">{o.title}</span>
                  <span className="block text-[13px] text-muted truncate">{o.authors[0]}</span>
                </span>
              </label>
            ))}
          </div>
          <Link href={`/profil/${loan.other?.id}`} className="text-sm font-medium text-accent-hover hover:underline underline-offset-4 mt-3 inline-block">{m.wholeSwapShelf}</Link>
        </fieldset>
      )}
      <div className="grid md:grid-cols-2 gap-5 md:gap-4">
      {loan.ownerSpots.length > 0 ? (
        <Field label={m.spot} hint={m.spotHint}>
          <Select value={spot} onChange={(e) => setSpot(e.target.value)}>
            {loan.ownerSpots.map((s) => <option key={s.id} value={s.id}>{s.label}{s.dropoff ? m.dropoffPossible : ""}</option>)}
          </Select>
        </Field>
      ) : loan.circle?.fixed_spot ? (
        <div className="text-[15px]"><span className="block text-[13px] font-medium mb-2">{m.circleSpot}</span><span className="flex items-center h-12 px-4 rounded-[8px] bg-paper-2 border border-line">{loan.circle.fixed_spot}</span></div>
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
         
        <img key={k} src={`/api/v1/images/${k}?w=480`} alt={m.uploadedPhoto} className="h-20 w-20 object-cover rounded-[10px] outline outline-1 -outline-offset-1 outline-black/10 anim-pop" />
      ))}
      {keys.length < max && (
        <label className={cx("h-20 px-5 grid place-items-center border border-dashed border-line-strong rounded-[10px] bg-paper text-sm font-medium cursor-pointer hover:border-accent hover:text-accent-hover transition-colors", busy && "opacity-50")}>
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

function ConditionForm({ loanId, busy, onSubmit, onSkip, skipped }: { loanId: string; busy: boolean; onSubmit: (note: string, keys: string[]) => void; onSkip: () => void; skipped: boolean }) {
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

function DamageForm({ loan, busy, onSubmit }: { loan: LoanView; busy: boolean; onSubmit: (d: string, keys: string[]) => void }) {
  const [d, setD] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const m = STEPS[useLocale()];
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      <p className="text-[15px] text-ink-2">{m.damageIntro(Boolean(loan.conditionNote))}<Link href="/hilfe#schaden" className="underline underline-offset-4">{m.examples}</Link></p>
      <Textarea aria-label={m.describeDamage} value={d} onChange={(e) => setD(e.target.value)} placeholder={m.damagePlaceholder} maxLength={1000} />
      <PhotoPicker loanId={loan.id} purpose="case" keys={keys} setKeys={setKeys} />
      <Button variant="secondary" disabled={busy || d.trim().length < 5 || keys.length === 0} onClick={() => onSubmit(d, keys)}>{m.reportDamage}</Button>
      {keys.length === 0 && <p className="text-sm text-muted">{m.photoNeeded}</p>}
    </div>
  );
}

function ReportHandover({ loan, busy, onReport }: { loan: LoanView; busy: boolean; onReport: (photoKey: string | null) => void }) {
  const [mode, setMode] = useState<"report" | "dropoff">("report");
  const [keys, setKeys] = useState<string[]>([]);
  const dropoff = loan.role === "owner" && loan.copySettings.dropoff_allowed;
  const m = STEPS[useLocale()];
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      {dropoff && (
        <div className="grid sm:grid-cols-2 gap-2 text-[15px]">
          <label className={radioCard}><input type="radio" checked={mode === "report"} onChange={() => setMode("report")} className="accent-[var(--ink)] h-4 w-4" /> {m.inPerson}</label>
          <label className={radioCard}><input type="radio" checked={mode === "dropoff"} onChange={() => setMode("dropoff")} className="accent-[var(--ink)] h-4 w-4" /> {m.inDropoff}</label>
        </div>
      )}
      <p className="text-[15px] text-ink-2">{mode === "dropoff" ? m.dropoffText : m.reportText}</p>
      {mode === "dropoff" && <PhotoPicker loanId={loan.id} purpose="dropoff" keys={keys} setKeys={setKeys} max={1} />}
      <Button variant="secondary" disabled={busy || (mode === "dropoff" && !keys.length)} onClick={() => onReport(mode === "dropoff" ? keys[0] : null)}>{m.reportHandover}</Button>
    </div>
  );
}

function RateForm({ busy, onRate }: { busy: boolean; onRate: (v: "good" | "problems", reasons: string[], note?: string) => void }) {
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
            className="min-h-11 pl-3 pr-4 rounded-[6px] bg-paper border border-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/35 transition-colors" />
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

function CaseResponse({ loan, onDone }: { loan: LoanView; onDone: () => void }) {
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
          <label key={o} className={cx(radioCard, "text-[15px]")}>
            <input type="radio" name="case" checked={choice === o} onChange={() => setChoice(o)} className="accent-[var(--accent)] h-4 w-4 flex-none" />
            {labels(l).caseResponseLabel[o]}
          </label>
        ))}
      </div>
      {choice === "return_date" && <Field label={m.returnOn}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-52" /></Field>}
      {choice === "swap_offer" && (
        <Field label={m.yourBook}>
          <Select value={swapCopy} onChange={(e) => setSwapCopy(e.target.value)}>
            {loan.myOfferable.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
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

function Reschedule({ loan, busy, onSubmit, onCancelFree }: { loan: LoanView; busy: boolean; onSubmit: (s: string, e: string) => void; onCancelFree: () => void }) {
  const [start, setStart] = useState(loan.wanted!.start);
  const l = useLocale();
  const m = STEPS[l];
  const [days, setDays] = useState(Math.max(1, Math.round((dayToDate(loan.wanted!.end!).getTime() - dayToDate(loan.wanted!.start).getTime()) / 86400_000)));
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      <p className="text-[15px] text-ink-2">{m.rescheduleText}</p>
      <div className="flex flex-wrap gap-4 items-end">
        <Field label={m.start}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-48" /></Field>
        <Field label={m.days}><Input type="number" min={1} max={loan.copySettings.loan_days} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} className="w-24" /></Field>
        <Button variant="secondary" disabled={busy} onClick={() => onSubmit(start, addDays(start, days))}>{m.apply}</Button>
      </div>
      <p className="text-sm text-muted">{m.until(fmtDay(dayToDate(addDays(start, days - 1)), l))}</p>
      <Button variant="quiet" onClick={onCancelFree}>{m.cancelFree}</Button>
    </div>
  );
}
