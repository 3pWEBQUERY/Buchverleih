"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { LoanView } from "@/lib/loans/queries";
import { caseResponseLabel } from "@/lib/i18n/de-CH";
import { labels } from "@/lib/i18n/labels";
import { useLocale } from "@/components/locale-provider";
import { STEPS } from "@/lib/i18n/messages/loans-steps";
import { dayToDate, deadline, dueDay, fmtDay, relHours } from "@/lib/dates";
import { Button, Field, Select, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { HandoverCode } from "./handover-code";
import { ScanOverlay } from "./scan-overlay";
import { AcceptForm, CaseResponse, ConditionForm, DamageForm, RateForm, ReportHandover, ReportReturn, Reschedule, ShipForm } from "./step-forms";
import { SHIPPING } from "@/lib/i18n/messages/shipping";
import { Presence, celebrateHandover } from "@/components/motion";

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
  // Vor der Übergabe (angenommen bzw. Weitergabe): der erfolgreiche Scan ist der feierliche Moment
  const handingOver = loan.status === "accepted" || Boolean(loan.nextLoan?.received_from_loan_id === loan.id && loan.status === "active");
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

  /** Nicht umkehrbare Wechsel werden kurz verzögert und lassen sich bis dahin rückgängig machen. Dieselbe Aktion nur einmal einreihen. */
  const [queued, setQueued] = useState<string | null>(null);
  function deferred(text: string, body: Record<string, unknown>) {
    const key = String(body.action);
    if (queued === key || busy) return;
    setQueued(key);
    toast.deferred(text, async () => {
      try {
        await api(`/loans/${loan.id}/actions`, { body });
        refresh();
      } finally {
        setQueued(null);
      }
    });
    // Rückgängig gemacht: nach Ablauf der Frist wieder freigeben
    setTimeout(() => setQueued((q) => (q === key ? null : q)), 5500);
  }
  const off = busy || queued !== null;

  // Mobil: solange der Schritt selbst nicht im Bild ist, klebt sein Knopf über der Tab-Navigation
  const panelRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const step = loan.step;
  const t = loan.times;
  const passOnNext = loan.nextLoan?.received_from_loan_id === loan.id ? loan.nextLoan : null;
  const passOnAskPrev = !owner && loan.nextLoan && loan.nextLoan.pass_on_owner_ok === true && loan.nextLoan.pass_on_prev_ok == null && !loan.nextLoan.received_from_loan_id;

  // ---------------------------------------------------------------- Hauptbereich
  let main: React.ReactNode = null;
  let context: React.ReactNode = null;
  /** Ein-Knopf-Schritte: derselbe Schritt klebt mobil als Leiste über der Tab-Navigation */
  let bar: { label: string; run: () => void } | null = null;

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
        main = <AcceptForm loan={loan} busy={off} onAccept={(b) => act({ action: "accept", ...b }, m.accepted)} onDecline={() => deferred(m.declined, { action: "decline" })} />;
        break;
      case "show_code":
        context = loan.kind === "swap" ? m.showCodeSwap : m.showCodeLend(loan.other?.first_name ?? "");
        bar = { label: step.label, run: () => setOverlay({ kind: "code", label: loan.kind === "swap" ? m.swapCode : m.handoverCode }) };
        main = <Button variant="primary" size="lg" onClick={bar.run}>{step.label}</Button>;
        break;
      case "scan_code":
        context = loan.kind === "swap" ? m.scanSwap : m.scanLend(loan.received_from_loan_id ? m.currentHolder : loan.other?.first_name ?? "");
        bar = { label: step.label, run: () => setOverlay({ kind: "scan", label: m.scanCode }) };
        main = <Button variant="primary" size="lg" onClick={bar.run}>{step.label}</Button>;
        break;
      case "confirm_handover":
        context = loan.handoverMethod === "shipping"
          ? SHIPPING[l].confirmCtx(loan.other?.first_name ?? "")
          : m.confirmHandover(loan.other?.first_name ?? "", loan.handoverMethod === "dropoff",
            t.handover_reported_at ? m.inRel(relHours(new Date(new Date(t.handover_reported_at).getTime() + 48 * 3600_000), l)) : m.after48);
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_handover" }, m.confirmed)}>{step.label}</Button>{(bar = { label: step.label, run: () => act({ action: "confirm_handover" }, m.confirmed) }) && null}
            <Button variant="quiet" onClick={() => act({ action: "object_handover" }, m.objected)}>{m.nothingReceived}</Button>
          </div>
        );
        break;
      case "ship":
        context = SHIPPING[l].shipCtx(loan.other?.first_name ?? "");
        main = <ShipForm address={loan.shipping?.shipTo ?? null} busy={off} label={SHIPPING[l].shipped}
          onSend={(tracking) => act({ action: "report_handover", tracking }, SHIPPING[l].sentToast)} />;
        break;
      case "ship_back":
        context = SHIPPING[l].shipBackCtx(t.due_at ? deadline(dueDay(t.due_at), m.returnBy, l) : "");
        main = <ShipForm address={loan.shipping?.returnTo ?? null} busy={off} label={SHIPPING[l].shippedBack}
          onSend={(tracking) => act({ action: "report_return", tracking }, SHIPPING[l].returnedToast)} />;
        break;
      case "return_code":
        context = t.due_at ? m.returnCode(deadline(dueDay(t.due_at), m.returnBy, l), loan.other?.first_name ?? "") : m.showOnReturn;
        bar = { label: step.label, run: () => setOverlay({ kind: "code", label: m.returnCodeLabel }) };
        main = <Button variant="primary" size="lg" onClick={bar.run}>{step.label}</Button>;
        break;
      case "scan_return":
        context = t.due_at ? m.scanReturnCtx(loan.other?.first_name ?? "", deadline(dueDay(t.due_at), m.returnBy, l)) : null;
        main = <Button variant="secondary" size="lg" onClick={() => setOverlay({ kind: "scan", label: m.scanReturn })}>{step.label}</Button>;
        break;
      case "confirm_return":
        context = m.confirmReturn(loan.other?.first_name ?? "");
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_return" }, m.returnConfirmed)}>{step.label}</Button>{(bar = { label: step.label, run: () => act({ action: "confirm_return" }, m.returnConfirmed) }) && null}
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
        main = <ConditionForm loanId={loan.id} busy={busy} onSubmit={(note, photoKeys) => act({ action: "condition_note", note, photoKeys }, m.conditionSaved)} onSkip={() => setPanel("skip-cond")} skipped={panel === "skip-cond"} required={Boolean(loan.received_from_loan_id)} />;
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
            {p && <span className="text-body-sm text-muted self-center">{m.consents([p.owner, p.prev, p.next].filter(Boolean).length)}</span>}
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
  if (can("withdraw")) secondary.push(<Button key="w" variant="quiet" disabled={off} onClick={() => deferred(m.withdrawn, { action: "withdraw" })}>{m.withdraw}</Button>);
  if (can("cancel")) secondary.push(<Button key="c" variant="quiet" disabled={off} onClick={() => deferred(m.cancelled, { action: "cancel" })}>{m.cancel}</Button>);
  if (loan.status === "accepted" && !loan.handoverReportedBy && loan.kind !== "swap" && !loan.received_from_loan_id && !loan.shipping) {
    secondary.push(<Button key="rh" variant="quiet" onClick={() => setPanel(panel === "report" ? null : "report")}>{m.reportHandoverBtn}</Button>);
  }
  if (loan.status === "active" && !owner) {
    if (!loan.extensionRequested && loan.extensionsUsed < loan.copySettings.max_extensions && !t.recalled_at)
      secondary.push(<Button key="e" variant="quiet" disabled={off} onClick={() => act({ action: "extend" }, loan.copySettings.auto_extend ? m.extended : m.extensionAsked)}>{loan.copySettings.auto_extend ? m.extendAuto : m.extendAsk}</Button>);
    secondary.push(loan.copySettings.dropoff_allowed
      ? <Button key="rr" variant="quiet" disabled={off} onClick={() => setPanel(panel === "return" ? null : "return")}>{m.reportReturnBtn}</Button>
      : <Button key="rr" variant="quiet" disabled={off} onClick={() => act({ action: "report_return" }, m.returnReported)}>{m.reportReturnBtn}</Button>);
    if (loan.myOfferable.length) secondary.push(<Button key="os" variant="quiet" onClick={() => setPanel(panel === "swap" ? null : "swap")}>{m.offerSwapBtn}</Button>);
  }
  if (loan.status === "active" && owner) {
    if (!t.recalled_at && t.handed_over_at && Date.now() - new Date(t.handed_over_at).getTime() > 14 * 86400_000)
      secondary.push(<Button key="rc" variant="quiet" disabled={off} onClick={() => deferred(m.recalled, { action: "recall" })}>{m.recall}</Button>);
    if (t.due_at && new Date(t.due_at) < new Date(Date.now() - 3 * 86400_000))
      secondary.push(<Button key="oc" variant="quiet" disabled={off} onClick={() => act({ action: "open_case" }, m.caseOpened)}>{m.openCase}</Button>);
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

  const showBar = Boolean(bar && myTurn && !overlay && !inView);

  if (!heading && !context && !main && secondary.length === 0) {
    return null;
  }

  return (
    <section ref={panelRef} aria-label={m.aria} className={cx(
      "anim-rise rounded-lg",
      myTurn ? "bg-paper-2 px-5 py-6 md:p-8" : "border border-line px-5 py-6 md:px-8 md:py-7",
    )}>
      <p className="eyebrow flex items-center gap-2">
        <span aria-hidden className={cx("h-2 w-2 rounded-full", myTurn ? "bg-accent live-dot" : loan.turn === "done" ? "bg-done" : "bg-wait")} />
        {eyebrow}
      </p>
      {heading && (
        <h2 className={cx("mt-2.5 font-title tracking-title leading-display", myTurn ? "text-display " : "text-title ")}>{heading}</h2>
      )}
      {context && <p className={cx("text-lead leading-relaxed text-ink-2 max-w-2xl", heading ? "mt-3" : "")}>{context}</p>}
      {main && <div className="mt-7">{main}</div>}
      {secondary.length > 0 && (
        <div className={cx("flex flex-wrap items-center gap-x-6 gap-y-1 mt-7 pt-4 border-t", myTurn ? "border-line-strong/60" : "border-line")}>
          <span className="text-meta text-muted mr-1">{m.more}</span>
          {secondary.map((b, i) => <span key={i} className="inline-flex min-h-11 items-center">{b}</span>)}
        </div>
      )}

      <Presence show={panel === "report"}>
        <ReportHandover loan={loan} busy={busy} onReport={(dropoffPhotoKey) => act({ action: "report_handover", dropoffPhotoKey }, m.handoverReported)} />
      </Presence>
      <Presence show={panel === "return"}>
        <ReportReturn loan={loan} busy={busy} onReport={(dropoffPhotoKey) => act({ action: "report_return", dropoffPhotoKey }, m.returnReported)} />
      </Presence>
      <Presence show={panel === "damage"}><DamageForm loan={loan} busy={busy} onSubmit={(description, photoKeys) => act({ action: "report_damage", description, photoKeys }, m.damageReported)} /></Presence>
      <Presence show={panel === "swap"}>
        <div className="mt-6 border-t border-line pt-5 max-w-md">
          <Field label={m.whichBook}>
            <Select value="" placeholder={m.chooseBook} onChange={(v) => v && act({ action: "offer_swap", copyId: v }, m.swapOffered)}
              options={loan.myOfferable.map((o) => ({ value: o.id, label: <span className="font-serif">{o.title}</span>, text: o.title }))} />
          </Field>
        </div>
      </Presence>
      <Presence show={panel === "reschedule" && Boolean(loan.wanted)}>{loan.wanted && <Reschedule loan={loan} busy={busy} onSubmit={(start, end) => act({ action: "reschedule", start, end }, m.rescheduled)} onCancelFree={() => act({ action: "cancel_without_penalty" }, m.cancelled)} />}</Presence>

      <StickyStep show={showBar} label={bar?.label ?? ""} eyebrow={m.yourTurn} disabled={off} onRun={() => bar?.run()} />
      {overlay?.kind === "code" && (
        <HandoverCode loanId={overlay.loanId ?? loan.id} label={overlay.label} onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); if (handingOver) celebrateHandover(); toast.show({ text: m.scanned }); refresh(); }} />
      )}
      {overlay?.kind === "scan" && (
        <ScanOverlay loanId={loan.id} label={overlay.label} onClose={() => setOverlay(null)}
          onDone={(r) => { setOverlay(null); if (handingOver && !r.waitingForOther) celebrateHandover(); toast.show({ text: r.waitingForOther ? m.scannedShowYours : m.confirmed }); refresh(); }} />
      )}
    </section>
  );
}

/**
 * «Ein Blick, ein Schritt»: auf dem Telefon klebt der nächste Schritt als Leiste über der Tab-Navigation,
 * sobald der Abschnitt aus dem Bild gescrollt ist. data-sheet am <body> schiebt die Toasts darüber
 * und vergrössert den Abstand für den Tastaturfokus (globals.css).
 */
function StickyStep({ show, label, eyebrow, disabled, onRun }: { show: boolean; label: string; eyebrow: string; disabled: boolean; onRun: () => void }) {
  useEffect(() => {
    if (!show || !window.matchMedia("(max-width: 767px)").matches) return;
    document.body.dataset.sheet = "1";
    return () => { delete document.body.dataset.sheet; };
  }, [show]);
  // Ausserhalb des animierten Abschnitts rendern: dessen transform wäre sonst der Bezugsrahmen für position: fixed
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <Presence show={show} enter="anim-sheet"
      className="md:hidden fixed z-30 inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] bg-paper border-t border-line px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-meta text-muted flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-accent flex-none" /><span className="truncate">{eyebrow}</span></p>
        <Button variant="primary" className="flex-none max-w-[70%] !whitespace-normal text-left leading-tight min-h-11 h-auto py-2" disabled={disabled} onClick={onRun}>{label}</Button>
      </div>
    </Presence>,
    host,
  );
}
