"use client";
import Link from "next/link";
import { useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Field, Input, cx } from "@/components/ui";
import { AuthHead } from "@/components/auth/head";
import { IconArrowRight, IconCalendar, IconCheck } from "@/components/icons";

/** Anmeldung ohne Hürden: drei Angaben, dann die Mobilnummer (PRD 6.1, 6.6). */
export function Onboarding({ initialStep, next, firstName, devCodes }: { initialStep: "profile" | "phone"; next: string; firstName: string; devCodes: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState(firstName);
  const [plz, setPlz] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState<null | { devCode?: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "region_closed") setClosed(true);
      setError(err.message);
    } finally { setBusy(false); }
  }

  const steps = ["Profil", "Mobilnummer"];
  const idx = step === "profile" ? 0 : 1;

  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 mb-9" aria-label="Schritte">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === idx ? "step" : undefined}>
            <span className={cx("block h-1.5 rounded-full transition-colors duration-500", i < idx ? "bg-ok" : i === idx ? "bg-accent" : "bg-paper-3")} />
            <span className={cx("mt-2.5 flex items-center gap-2 text-[13px]", i === idx ? "text-ink font-medium" : "text-muted")}>
              <span className="tnum">{String(i + 1).padStart(2, "0")}</span> {s}
              {i < idx && <IconCheck width={15} height={15} className="text-ok" />}
            </span>
          </li>
        ))}
      </ol>

      {step === "profile" && (
        <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/me", { body: { firstName: name, plz, birthDate: birth } }); setStep("phone"); }); }}>
          <AuthHead title={<>Willkommen. <em>Wer bist du?</em></>}>Andere sehen deinen Vornamen und deine Gemeinde. Nie deine Adresse.</AuthHead>
          <div className="space-y-6">
            <Field label="Vorname"><Input required autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
            <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[140px_1fr] gap-3 sm:gap-4">
              <Field label="Postleitzahl">
                <Input required inputMode="numeric" autoComplete="postal-code" maxLength={4} value={plz} onChange={(e) => setPlz(e.target.value.replace(/\D/g, ""))} className="tnum" placeholder="8180" />
              </Field>
              <Field label="Geburtsdatum">
                <Input required type="date" value={birth} onChange={(e) => setBirth(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>
            <ul className="rounded-[10px] bg-paper-2 p-4 space-y-3 text-[13.5px] text-ink-2 leading-snug [&_svg]:text-accent-hover">
              <li className="grid grid-cols-[20px_1fr] gap-3"><IconPin /><span>Die Postleitzahl findet Bücher in deiner Nähe. Dein Standort wird auf rund 100 m gerundet und zusätzlich verschoben angezeigt.</span></li>
              <li className="grid grid-cols-[20px_1fr] gap-3"><IconCalendar width={18} height={18} className="mt-0.5" /><span>Für ein eigenes Konto brauchst du mindestens 16 Jahre. Gespeichert wird nur, dass du alt genug bist.</span></li>
            </ul>
            {error && <p className="text-late" role="alert">{error}</p>}
            {closed && <p className="text-sm"><Link href="/" className="font-medium text-accent-hover hover:underline underline-offset-4">Zur Startseite und auf die Warteliste</Link></p>}
            <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto" disabled={busy}>Weiter <IconArrowRight width={18} height={18} /></Button>
          </div>
        </form>
      )}

      {step === "phone" && (
        <div className="anim-rise">
          <AuthHead title={<>Deine Mobilnummer. <em>Ein Konto pro Person.</em></>}>
            Eine Nummer, ein Konto. Das schützt alle vor Mehrfachkonten. Wir geben die Nummer nie weiter und schicken SMS nur zur Bestätigung und bei einem offenen Fall.
          </AuthHead>
          {!codeSent ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); run(async () => setCodeSent(await api("/me/phone", { body: { phone } }))); }}>
              <Field label="Mobilnummer" error={error}>
                <Input required type="tel" autoComplete="tel" inputMode="tel" placeholder="079 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} className="tnum" />
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto" disabled={busy}>Code senden <IconArrowRight width={18} height={18} /></Button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/me/phone/verify", { body: { code } }); router.replace(safeNext(next) || "/"); router.refresh(); }); }}>
              <Field label="Code aus der SMS" error={error} hint={codeSent.devCode ? `Testumgebung ohne SMS-Versand: ${codeSent.devCode}` : "Sechs Ziffern, 10 Minuten gültig."}>
                <Input required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="max-w-[240px] text-[24px] tracking-[0.35em] tnum h-14 text-center font-medium" placeholder="······" />
              </Field>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button type="submit" variant="primary" size="lg" disabled={busy || code.length !== 6}>Bestätigen</Button>
                <Button type="button" variant="quiet" className="h-11 text-sm" onClick={() => { setCodeSent(null); setCode(""); }}>Andere Nummer</Button>
              </div>
            </form>
          )}
          <div className="mt-10 pt-6 border-t border-line">
            <Button type="button" variant="quiet" className="h-11 text-sm" onClick={() => { router.replace("/"); router.refresh(); }}>
              Später – erst einmal umsehen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
