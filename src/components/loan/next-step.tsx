"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, uploadPhoto } from "@/lib/client";
import type { LoanView } from "@/lib/loans/queries";
import { caseResponseLabel, ratingReasonLabel } from "@/lib/i18n/de-CH";
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
    context = <>Du gibst das Buch direkt an <strong className="font-medium">{passOnNext.borrower_name}</strong> weiter. Zeig ihr oder ihm deinen Code – der Scan beendet deine Leihe und startet die nächste im selben Moment.</>;
    main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: "Weitergabecode", loanId: passOnNext.id })}>Weitergabecode zeigen</Button>;
  } else if (passOnAskPrev) {
    context = <>{loan.nextLoan!.borrower_name} hat das Buch ab {fmtDay(dayToDate(loan.nextLoan!.start))} gebucht. Gibst du es direkt weiter? Das spart euch zwei Treffen. Bis zum Scan bist du verantwortlich, danach die nächste Person.</>;
    main = (
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: true }, "Zugestimmt", loan.nextLoan!.id)}>Ja, direkt weitergeben</Button>
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: false }, "Das Buch geht über den Verleiher", loan.nextLoan!.id)}>Lieber über den Verleiher</Button>
      </div>
    );
  } else if (step) {
    switch (step.key) {
      case "respond":
        context = loan.kind === "swap" ? "Wähle eines der angebotenen Bücher – oder lehne ohne Begründung ab." : "Nimm an und schlage Ort und Zeit vor – oder lehne ohne Begründung ab.";
        main = <AcceptForm loan={loan} busy={busy} onAccept={(b) => act({ action: "accept", ...b }, "Angenommen")} onDecline={() => deferred("Anfrage abgelehnt", { action: "decline" })} />;
        break;
      case "show_code":
        context = loan.kind === "swap"
          ? "Beim Treffen zeigt jede Seite ihren Code, die andere scannt ihn. Beide Scans innert 10 Minuten."
          : <>Beim Treffen zeigst du den Code, {loan.other?.first_name} scannt ihn. Damit beginnt die Leihfrist.</>;
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: loan.kind === "swap" ? "Tauschcode" : "Übergabecode" })}>{step.label}</Button>;
        break;
      case "scan_code":
        context = loan.kind === "swap" ? "Dein Code ist gescannt. Scanne jetzt den Code der anderen Seite." : <>Beim Treffen zeigt {loan.received_from_loan_id ? "die Person, die das Buch gerade hat," : loan.other?.first_name} dir einen Code. Scanne ihn mit der Kamera.</>;
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "scan", label: "Code scannen" })}>{step.label}</Button>;
        break;
      case "confirm_handover":
        context = <>{loan.other?.first_name} meldet die Übergabe{loan.handoverMethod === "dropoff" ? " in die Ablage" : ""}. Ohne Einspruch gilt sie {t.handover_reported_at ? relHours(new Date(new Date(t.handover_reported_at).getTime() + 48 * 3600_000)).replace("noch", "in") : "nach 48 Stunden"}.</>;
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_handover" }, "Bestätigt")}>{step.label}</Button>
            <Button variant="quiet" onClick={() => act({ action: "object_handover" }, "Einspruch erfasst")}>Ich habe nichts erhalten</Button>
          </div>
        );
        break;
      case "return_code":
        context = t.due_at ? <>{deadline(dueDay(t.due_at), "Zurück bis")}. Beim Treffen zeigst du den Code, {loan.other?.first_name} scannt ihn.</> : "Zeig den Code beim Zurückgeben.";
        main = <Button variant="primary" size="lg" onClick={() => setOverlay({ kind: "code", label: "Rückgabecode" })}>{step.label}</Button>;
        break;
      case "scan_return":
        context = t.due_at ? <>{loan.other?.first_name} hat das Buch. {deadline(dueDay(t.due_at), "Zurück bis")}. Bei der Rückgabe scannst du den Code.</> : null;
        main = <Button variant="secondary" size="lg" onClick={() => setOverlay({ kind: "scan", label: "Rückgabe scannen" })}>{step.label}</Button>;
        break;
      case "confirm_return":
        context = <>{loan.other?.first_name} meldet die Rückgabe. Ohne Einspruch gilt sie nach 48 Stunden.</>;
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "confirm_return" }, "Rückgabe bestätigt")}>{step.label}</Button>
            <Button variant="quiet" onClick={() => act({ action: "object_return" }, "Einspruch erfasst")}>Das Buch ist nicht zurück</Button>
          </div>
        );
        break;
      case "inspect":
        context = <>Prüfe das Buch. Ohne Meldung wird die Leihe {t.inspection_until ? relHours(t.inspection_until).replace("noch", "in") : "nach 48 Stunden"} abgeschlossen. Normale Lesespuren sind kein Schaden.</>;
        main = (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "complete" }, "Abgeschlossen")}>{step.label}</Button>
            <Button variant="quiet" onClick={() => setPanel(panel === "damage" ? null : "damage")}>Schaden melden</Button>
          </div>
        );
        break;
      case "condition_note":
        context = <>Halte Mängel fest, die schon da waren{t.condition_note_until ? ` (${relHours(t.condition_note_until)})` : ""}. {loan.handoverMethod === "pass_on" ? "Bei einer Weitergabe ist das Pflicht: Was du nicht meldest, verantwortest du selbst." : "Danach gilt der Zustand aus dem Inserat."}</>;
        main = <ConditionForm loanId={loan.id} busy={busy} onSubmit={(note, photoKeys) => act({ action: "condition_note", note, photoKeys }, "Zustand festgehalten")} onSkip={() => setPanel("skip-cond")} skipped={panel === "skip-cond"} />;
        break;
      case "grant_extension":
        context = <>{loan.other?.first_name} möchte das Buch länger behalten.</>;
        main = <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "grant_extension" }, "Verlängert")}>{step.label}</Button>;
        break;
      case "accept_swap_offer":
        context = <>{loan.other?.first_name} möchte «{loan.title}» behalten und bietet dir dafür «{loan.swapOffer?.title}» an.</>;
        main = <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "accept_swap_offer" }, "Als Tausch abgeschlossen")}>Tausch annehmen</Button>;
        break;
      case "case_respond":
        context = loan.case?.kind === "damage" ? "Ein Schaden wurde gemeldet. Wähle eine von drei Antworten." : "Das Buch ist überfällig und ein Fall ist offen. Wähle, wie es weitergeht.";
        main = <CaseResponse loan={loan} onDone={refresh} />;
        break;
      case "case_resolve":
        context = <>Antwort im Fall: {loan.case?.response ? caseResponseLabel[loan.case.response as keyof typeof caseResponseLabel] : ""}{loan.case?.response_detail ? ` – ${loan.case.response_detail}` : ""}</>;
        main = (
          <Button variant="primary" size="lg" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await api(`/cases/${loan.case!.id}`, { body: { action: "resolve", outcome: "replaced" } }); toast.show({ text: "Fall gelöst" }); refresh(); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{step.label}</Button>
        );
        break;
      case "rate":
        context = "Eine Antwort reicht. Sie wird erst sichtbar, wenn beide geantwortet haben oder 14 Tage vergangen sind.";
        main = <RateForm busy={busy} onRate={(verdict, reasons, note) => act({ action: "rate", verdict, reasons, note }, "Danke")} />;
        break;
      case "clear_loss":
        context = "Kam das Buch doch zurück oder hast du Ersatz erhalten? Dann wird der Verlust bereinigt.";
        main = <Button variant="secondary" disabled={busy} onClick={() => act({ action: "clear_loss" }, "Verlust bereinigt")}>{step.label}</Button>;
        break;
      case "pass_on_consent": {
        const p = loan.passOn;
        context = owner ? <>Die nächste Leihe schliesst an. Direkt von der aktuellen Person an {loan.other?.first_name} weitergeben? Erst mit drei Zustimmungen gilt es.</> : <>Holst du das Buch direkt bei der Person ab, die es gerade hat? Ihr sprecht Ort und Zeit im Übergabe-Chat ab.</>;
        main = (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: true }, "Zugestimmt")}>Ja, direkt weitergeben</Button>
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => act({ action: "pass_on_consent", agree: false }, "Über den Verleiher")}>Nein</Button>
            {p && <span className="text-sm text-muted self-center">Zustimmungen: {[p.owner, p.prev, p.next].filter(Boolean).length} von 3</span>}
          </div>
        );
        break;
      }
    }
  } else if (loan.waitingText) {
    context = loan.status === "requested" ? <>Wartet auf Antwort von {loan.other?.first_name}. Ohne Antwort verfällt die Anfrage {relHours(t.respond_by).replace("noch", "in")}.</> : loan.waitingText;
  }

  // ---------------------------------------------------------------- Sekundäre Handlungen
  const can = (a: string) => loan.actions.includes(a as never);
  const secondary: React.ReactNode[] = [];
  if (can("withdraw")) secondary.push(<Button key="w" variant="quiet" onClick={() => deferred("Anfrage zurückgezogen", { action: "withdraw" })}>Anfrage zurückziehen</Button>);
  if (can("cancel")) secondary.push(<Button key="c" variant="quiet" onClick={() => deferred("Storniert", { action: "cancel" })}>Stornieren</Button>);
  if (loan.status === "accepted" && !loan.handoverReportedBy && loan.kind !== "swap" && !loan.received_from_loan_id) {
    secondary.push(<Button key="rh" variant="quiet" onClick={() => setPanel(panel === "report" ? null : "report")}>Übergabe ohne Scan melden</Button>);
  }
  if (loan.status === "active" && !owner) {
    if (!loan.extensionRequested && loan.extensionsUsed < loan.copySettings.max_extensions && !t.recalled_at)
      secondary.push(<Button key="e" variant="quiet" disabled={busy} onClick={() => act({ action: "extend" }, loan.copySettings.auto_extend ? "Verlängert" : "Verlängerung angefragt")}>{loan.copySettings.auto_extend ? "Um 14 Tage verlängern" : "Verlängerung anfragen"}</Button>);
    secondary.push(<Button key="rr" variant="quiet" onClick={() => act({ action: "report_return" }, "Rückgabe gemeldet")}>Rückgabe ohne Scan melden</Button>);
    if (loan.myOfferable.length) secondary.push(<Button key="os" variant="quiet" onClick={() => setPanel(panel === "swap" ? null : "swap")}>Behalten gegen Tausch anbieten</Button>);
  }
  if (loan.status === "active" && owner) {
    if (!t.recalled_at && t.handed_over_at && Date.now() - new Date(t.handed_over_at).getTime() > 14 * 86400_000)
      secondary.push(<Button key="rc" variant="quiet" onClick={() => deferred("Zurückgerufen – Rückgabe innert 7 Tagen", { action: "recall" })}>Zurückrufen</Button>);
    if (t.due_at && new Date(t.due_at) < new Date(Date.now() - 3 * 86400_000))
      secondary.push(<Button key="oc" variant="quiet" onClick={() => act({ action: "open_case" }, "Fall eröffnet")}>Fall eröffnen</Button>);
    if (step?.key !== "scan_return") secondary.push(<Button key="ro" variant="quiet" onClick={() => setOverlay({ kind: "scan", label: "Rückgabe scannen" })}>Rückgabe scannen</Button>);
  }
  if (loan.status === "accepted" && !owner && loan.kind === "lend" && loan.wanted && loan.wanted.start > new Date().toISOString().slice(0, 10)) {
    secondary.push(<Button key="rs" variant="quiet" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>Zeitraum ändern</Button>);
  }

  // ---------------------------------------------------------------- Kopf des Panels
  const passOn = Boolean((passOnNext && loan.status === "active" && !owner) || passOnAskPrev);
  const myTurn = passOn || Boolean(step && loan.turn === "me");
  const heading = passOnNext && loan.status === "active" && !owner ? "Weitergabecode zeigen"
    : passOnAskPrev ? "Direkt weitergeben?"
    : step && loan.turn === "me" ? step.label
    : loan.waitingText ?? step?.label ?? null;
  const eyebrow = myTurn ? "Du bist dran"
    : loan.turn === "done" ? "Abgeschlossen"
    : loan.turn === "system" ? "Am Zug: die Moderation"
    : `Am Zug: ${loan.other?.first_name ?? "die andere Seite"}`;

  if (!heading && !context && !main && secondary.length === 0) {
    return null;
  }

  return (
    <section aria-label="Nächster Schritt" className={cx(
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
          <span className="text-[12.5px] text-muted mr-1">Weitere Möglichkeiten</span>
          {secondary.map((b, i) => <span key={i} className="inline-flex min-h-11 items-center">{b}</span>)}
        </div>
      )}

      {panel === "report" && (
        <ReportHandover loan={loan} busy={busy} onReport={(dropoffPhotoKey) => act({ action: "report_handover", dropoffPhotoKey }, "Übergabe gemeldet")} />
      )}
      {panel === "damage" && <DamageForm loan={loan} busy={busy} onSubmit={(description, photoKeys) => act({ action: "report_damage", description, photoKeys }, "Schaden gemeldet")} />}
      {panel === "swap" && (
        <div className="mt-6 border-t border-line pt-5 max-w-md anim-rise">
          <Field label="Welches deiner Bücher bietest du an?">
            <Select defaultValue="" onChange={(e) => e.target.value && act({ action: "offer_swap", copyId: e.target.value }, "Tausch angeboten")}>
              <option value="" disabled>Buch wählen</option>
              {loan.myOfferable.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </Field>
        </div>
      )}
      {panel === "reschedule" && loan.wanted && <Reschedule loan={loan} busy={busy} onSubmit={(start, end) => act({ action: "reschedule", start, end }, "Zeitraum geändert")} onCancelFree={() => act({ action: "cancel_without_penalty" }, "Storniert")} />}

      <Portal>
      {overlay?.kind === "code" && (
        <HandoverCode loanId={overlay.loanId ?? loan.id} label={overlay.label} onClose={() => setOverlay(null)} onDone={() => { setOverlay(null); toast.show({ text: "Gescannt" }); refresh(); }} />
      )}
      {overlay?.kind === "scan" && (
        <ScanOverlay loanId={loan.id} label={overlay.label} onClose={() => setOverlay(null)}
          onDone={(r) => { setOverlay(null); toast.show({ text: r.waitingForOther ? "Gescannt. Jetzt zeigst du deinen Code." : "Bestätigt" }); refresh(); }} />
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

const radioCard = "flex items-center gap-3 min-h-14 px-4 py-3 rounded-[12px] bg-paper border border-line cursor-pointer hover:border-line-strong has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink transition-colors";

function AcceptForm({ loan, busy, onAccept, onDecline }: { loan: LoanView; busy: boolean; onAccept: (b: Record<string, unknown>) => void; onDecline: () => void }) {
  const [spot, setSpot] = useState(loan.ownerSpots[0]?.id ?? "");
  const [when, setWhen] = useState("");
  const [swapCopy, setSwapCopy] = useState(loan.swapOffered[0]?.id ?? "");
  const place = loan.ownerSpots.find((s) => s.id === spot)?.label ?? loan.circle?.fixed_spot ?? null;
  return (
    <div className="space-y-6 max-w-2xl">
      {loan.kind === "swap" && (
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">Angebotene Bücher</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {loan.swapOffered.map((o) => (
              <label key={o.id} className={radioCard}>
                <input type="radio" name="swap" checked={swapCopy === o.id} onChange={() => setSwapCopy(o.id)} className="accent-[var(--ink)] h-4 w-4 flex-none" />
                <span className="min-w-0">
                  <span className="block font-serif text-[19px] leading-tight truncate">{o.title}</span>
                  <span className="block text-[13px] text-muted truncate">{o.authors[0]}</span>
                </span>
              </label>
            ))}
          </div>
          <Link href={`/profil/${loan.other?.id}`} className="text-sm font-medium link-grow mt-3 inline-block">Ganzes Tauschregal ansehen</Link>
        </fieldset>
      )}
      <div className="grid md:grid-cols-2 gap-5 md:gap-4">
      {loan.ownerSpots.length > 0 ? (
        <Field label="Übergabeort" hint="Der genaue Ort wird erst nach der Annahme sichtbar.">
          <Select value={spot} onChange={(e) => setSpot(e.target.value)}>
            {loan.ownerSpots.map((s) => <option key={s.id} value={s.id}>{s.label}{s.dropoff ? " (Ablage möglich)" : ""}</option>)}
          </Select>
        </Field>
      ) : loan.circle?.fixed_spot ? (
        <div className="text-[15px]"><span className="block text-[13px] font-semibold mb-2">Übergabeort im Kreis</span><span className="flex items-center h-12 px-4 rounded-[10px] bg-paper border border-line">{loan.circle.fixed_spot}</span></div>
      ) : (
        <Notice className="self-end">Du hast noch keinen Übergabeort. <Link href="/einstellungen#orte" className="underline underline-offset-4">Ort festlegen</Link> oder im Chat absprechen.</Notice>
      )}
      <Field label="Terminvorschlag (freiwillig)" hint="Erscheint als Karte im Chat.">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <Button variant="primary" size="lg" disabled={busy || (loan.kind === "swap" && !swapCopy)}
          onClick={() => onAccept({ pickupSpotId: spot || null, proposalAt: when ? new Date(when).toISOString() : null, proposalPlace: when ? place : null, swapCopyId: loan.kind === "swap" ? swapCopy : null })}>
          Annehmen
        </Button>
        <Button variant="quiet" onClick={onDecline}>Ablehnen</Button>
      </div>
    </div>
  );
}

function PhotoPicker({ loanId, purpose, keys, setKeys, max = 6 }: { loanId: string; purpose: string; keys: string[]; setKeys: (k: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {keys.map((k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={`/api/v1/images/${k}?w=480`} alt="Hochgeladenes Foto" className="h-20 w-20 object-cover rounded-[10px] outline outline-1 -outline-offset-1 outline-black/10 anim-pop" />
      ))}
      {keys.length < max && (
        <label className={cx("h-20 px-5 grid place-items-center border border-dashed border-line-strong rounded-[10px] bg-paper text-sm font-medium cursor-pointer hover:border-ink transition-colors", busy && "opacity-50")}>
          {busy ? "Lädt …" : "Foto hinzufügen"}
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
  if (skipped) return <p className="text-muted">Alles gut, du kannst das bis zum Ablauf der Frist noch nachholen.</p>;
  return (
    <div className="space-y-4 max-w-xl">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Knick auf dem Umschlag, Bleistiftnotizen ab Seite 40" maxLength={500} />
      <PhotoPicker loanId={loanId} purpose="condition" keys={keys} setKeys={setKeys} />
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" size="lg" disabled={busy || (!note.trim() && !keys.length)} onClick={() => onSubmit(note, keys)}>Zustand festhalten</Button>
        <Button variant="quiet" onClick={onSkip}>Keine Mängel</Button>
      </div>
    </div>
  );
}

function DamageForm({ loan, busy, onSubmit }: { loan: LoanView; busy: boolean; onSubmit: (d: string, keys: string[]) => void }) {
  const [d, setD] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      <p className="text-[15px] text-ink-2">Verglichen wird mit dem Zustand im Inserat{loan.conditionNote ? " und der Zustandsnotiz bei der Übergabe" : ""}. Normale Lesespuren sind kein Schaden. <Link href="/hilfe#schaden" className="underline underline-offset-4">Beispiele</Link></p>
      <Textarea value={d} onChange={(e) => setD(e.target.value)} placeholder="Was ist beschädigt?" maxLength={1000} />
      <PhotoPicker loanId={loan.id} purpose="case" keys={keys} setKeys={setKeys} />
      <Button variant="secondary" disabled={busy || d.trim().length < 5 || keys.length === 0} onClick={() => onSubmit(d, keys)}>Schaden melden</Button>
      {keys.length === 0 && <p className="text-sm text-muted">Mindestens ein Foto ist nötig.</p>}
    </div>
  );
}

function ReportHandover({ loan, busy, onReport }: { loan: LoanView; busy: boolean; onReport: (photoKey: string | null) => void }) {
  const [mode, setMode] = useState<"report" | "dropoff">("report");
  const [keys, setKeys] = useState<string[]>([]);
  const dropoff = loan.role === "owner" && loan.copySettings.dropoff_allowed;
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      {dropoff && (
        <div className="grid sm:grid-cols-2 gap-2 text-[15px]">
          <label className={radioCard}><input type="radio" checked={mode === "report"} onChange={() => setMode("report")} className="accent-[var(--ink)] h-4 w-4" /> Persönlich übergeben</label>
          <label className={radioCard}><input type="radio" checked={mode === "dropoff"} onChange={() => setMode("dropoff")} className="accent-[var(--ink)] h-4 w-4" /> In der Ablage hinterlegt</label>
        </div>
      )}
      <p className="text-[15px] text-ink-2">{mode === "dropoff" ? "Lade ein Foto der Ablage hoch. Die andere Person bestätigt die Entnahme." : "Die andere Person wird um Bestätigung gebeten. Ohne Einspruch gilt die Meldung nach 48 Stunden."}</p>
      {mode === "dropoff" && <PhotoPicker loanId={loan.id} purpose="dropoff" keys={keys} setKeys={setKeys} max={1} />}
      <Button variant="secondary" disabled={busy || (mode === "dropoff" && !keys.length)} onClick={() => onReport(mode === "dropoff" ? keys[0] : null)}>Übergabe melden</Button>
    </div>
  );
}

function RateForm({ busy, onRate }: { busy: boolean; onRate: (v: "good" | "problems", reasons: string[], note?: string) => void }) {
  const [problems, setProblems] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  if (!problems) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => onRate("good", [])}>Gerne wieder</Button>
        <Button variant="secondary" size="lg" onClick={() => setProblems(true)}>Es gab Probleme</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4 max-w-xl anim-rise">
      <div className="flex flex-wrap gap-2">
        {Object.entries(ratingReasonLabel).map(([k, l]) => (
          <Check key={k} label={l} checked={reasons.includes(k)} onChange={(v) => setReasons((r) => (v ? [...r, k] : r.filter((x) => x !== k)))}
            className="min-h-11 pl-3 pr-4 rounded-[6px] bg-paper border border-line has-[:checked]:border-ink transition-colors" />
        ))}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was ist passiert? Geht nur an die Moderation." maxLength={500} />
      <div className="flex gap-4 items-center">
        <Button variant="primary" disabled={busy || reasons.length === 0} onClick={() => onRate("problems", reasons, note || undefined)}>Absenden</Button>
        <Button variant="quiet" onClick={() => setProblems(false)}>Zurück</Button>
      </div>
    </div>
  );
}

function CaseResponse({ loan, onDone }: { loan: LoanView; onDone: () => void }) {
  const toast = useToast();
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
            <input type="radio" name="case" checked={choice === o} onChange={() => setChoice(o)} className="accent-[var(--ink)] h-4 w-4 flex-none" />
            {caseResponseLabel[o]}
          </label>
        ))}
      </div>
      {choice === "return_date" && <Field label="Rückgabe am"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-52" /></Field>}
      {choice === "swap_offer" && (
        <Field label="Dein Buch">
          <Select value={swapCopy} onChange={(e) => setSwapCopy(e.target.value)}>
            {loan.myOfferable.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
        </Field>
      )}
      <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={choice === "object" ? "Warum ist das kein Schaden? Die Moderation entscheidet anhand der Fotos und des Verlaufs." : "Ergänzung (freiwillig)"} maxLength={500} />
      <Button variant="primary" size="lg" disabled={busy || (choice === "swap_offer" && !swapCopy)} onClick={async () => {
        setBusy(true);
        try {
          await api(`/cases/${loan.case!.id}`, { body: { action: "respond", response: choice, detail: detail || undefined, returnAt: choice === "return_date" ? new Date(`${date}T18:00:00`).toISOString() : undefined, swapCopyId: choice === "swap_offer" ? swapCopy : undefined } });
          toast.show({ text: "Antwort gesendet" });
          onDone();
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }}>Antworten</Button>
    </div>
  );
}

function Reschedule({ loan, busy, onSubmit, onCancelFree }: { loan: LoanView; busy: boolean; onSubmit: (s: string, e: string) => void; onCancelFree: () => void }) {
  const [start, setStart] = useState(loan.wanted!.start);
  const [days, setDays] = useState(Math.max(1, Math.round((dayToDate(loan.wanted!.end!).getTime() - dayToDate(loan.wanted!.start).getTime()) / 86400_000)));
  return (
    <div className="mt-6 border-t border-line pt-5 space-y-4 max-w-xl anim-rise">
      <p className="text-[15px] text-ink-2">Verschieben, soweit der Kalender frei ist, oder kürzer leihen. Wartest du auf eine verspätete Rückgabe, kannst du ohne Nachteil stornieren.</p>
      <div className="flex flex-wrap gap-4 items-end">
        <Field label="Beginn"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-48" /></Field>
        <Field label="Tage"><Input type="number" min={1} max={loan.copySettings.loan_days} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} className="w-24" /></Field>
        <Button variant="secondary" disabled={busy} onClick={() => onSubmit(start, addDays(start, days))}>Übernehmen</Button>
      </div>
      <p className="text-sm text-muted">Bis {fmtDay(dayToDate(addDays(start, days - 1)))}</p>
      <Button variant="quiet" onClick={onCancelFree}>Ohne Nachteil stornieren</Button>
    </div>
  );
}
