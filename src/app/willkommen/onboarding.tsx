"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Field, Input } from "@/components/ui";

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
      <ol className="flex gap-6 text-sm mb-10" aria-label="Schritte">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === idx ? "text-ink font-medium" : "text-muted"}`}>
            <span className={`h-5 w-5 grid place-items-center rounded-full border text-[11px] tnum ${i < idx ? "bg-ink text-paper border-ink" : i === idx ? "border-ink" : "border-line-strong"}`}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === "profile" && (
        <form className="space-y-6 anim-rise" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/me", { body: { firstName: name, plz, birthDate: birth } }); setStep("phone"); }); }}>
          <div>
            <h1 className="display text-5xl">Willkommen.</h1>
            <p className="text-ink-2 mt-3">Andere sehen deinen Vornamen und deine Gemeinde. Nie deine Adresse.</p>
          </div>
          <Field label="Vorname"><Input required autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
          <Field label="Postleitzahl" hint="Damit wir Bücher in deiner Nähe finden. Dein Standort wird auf rund 100 m gerundet und zusätzlich verschoben angezeigt.">
            <Input required inputMode="numeric" autoComplete="postal-code" maxLength={4} value={plz} onChange={(e) => setPlz(e.target.value.replace(/\D/g, ""))} className="w-40 tnum" />
          </Field>
          <Field label="Geburtsdatum" hint="Für ein eigenes Konto brauchst du mindestens 16 Jahre. Gespeichert wird nur, dass du alt genug bist.">
            <Input required type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="w-52" max={new Date().toISOString().slice(0, 10)} />
          </Field>
          {error && <p className="text-late" role="alert">{error}</p>}
          {closed && <p className="text-sm"><a href="/" className="underline underline-offset-4">Zur Startseite und auf die Warteliste</a></p>}
          <Button type="submit" variant="primary" size="lg" disabled={busy}>Weiter</Button>
        </form>
      )}

      {step === "phone" && (
        <div className="space-y-6 anim-rise">
          <div>
            <h1 className="display text-5xl">Deine Mobilnummer</h1>
            <p className="text-ink-2 mt-3">Eine Nummer, ein Konto. Das schützt alle vor Mehrfachkonten. Wir geben die Nummer nie weiter und schicken SMS nur zur Bestätigung und bei einem offenen Fall.</p>
          </div>
          {!codeSent ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); run(async () => setCodeSent(await api("/me/phone", { body: { phone } }))); }}>
              <Field label="Mobilnummer" error={error}>
                <Input required type="tel" autoComplete="tel" inputMode="tel" placeholder="079 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-64 tnum" />
              </Field>
              <Button type="submit" variant="primary" size="lg" disabled={busy}>Code senden</Button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/me/phone/verify", { body: { code } }); router.replace(next); router.refresh(); }); }}>
              <Field label="Code aus der SMS" error={error} hint={codeSent.devCode ? `Testumgebung ohne SMS-Versand: ${codeSent.devCode}` : "Sechs Ziffern, 10 Minuten gültig."}>
                <Input required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 text-2xl tracking-[0.3em] tnum h-14" />
              </Field>
              <div className="flex items-center gap-4">
                <Button type="submit" variant="primary" size="lg" disabled={busy || code.length !== 6}>Bestätigen</Button>
                <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => { setCodeSent(null); setCode(""); }}>Andere Nummer</button>
              </div>
            </form>
          )}
          <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => { router.replace("/"); router.refresh(); }}>
            Später – erst einmal umsehen
          </button>
        </div>
      )}
    </div>
  );
}
