"use client";
import { useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { api } from "@/lib/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { IconArrowRight, IconCheck } from "@/components/icons";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<null | { devLink?: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await api<{ devLink?: string }>("/auth/email", { body: { email, next } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function passkey() {
    setError(null);
    try {
      const { options, challengeId } = await api<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId: string }>("/auth/passkey/options", { method: "POST" });
      const response = await startAuthentication({ optionsJSON: options });
      await api("/auth/passkey/verify", { body: { challengeId, response } });
      router.replace(safeNext(next) || "/");
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (!/abort|cancel|NotAllowed/i.test(msg)) setError(msg);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[10px] border border-line p-6 md:p-7 anim-rise" aria-live="polite">
        <span className="h-11 w-11 rounded-full bg-accent-soft text-accent-hover grid place-items-center anim-pop"><IconCheck width={20} height={20} /></span>
        <p className="text-[26px] font-[560] tracking-[-0.03em] leading-tight mt-5">Schau in dein Postfach.</p>
        <p className="text-ink-2 mt-3">Wir haben einen Link an <strong className="font-medium text-ink break-all">{email}</strong> geschickt. Er gilt 20 Minuten.</p>
        {sent.devLink && (
          <Notice tone="accent" className="mt-6 text-sm">
            Testumgebung ohne Mailversand: <a className="underline underline-offset-4 font-semibold" href={sent.devLink}>Anmeldelink öffnen</a>
          </Notice>
        )}
        <Button variant="quiet" className="mt-4 h-11 text-sm" onClick={() => setSent(null)}>Andere Adresse verwenden</Button>
      </div>
    );
  }

  return (
    <div className="anim-rise" style={{ animationDelay: "60ms" }}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-Mail-Adresse" error={error}>
          <Input type="email" required autoComplete="email webauthn" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.ch" />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Wird gesendet …" : <>Anmeldelink senden <IconArrowRight width={18} height={18} /></>}
        </Button>
      </form>
      <div className="flex items-center gap-4 my-7 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" /> oder <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={passkey}>
        <IconKey /> Mit Passkey anmelden
      </Button>
      <ul className="mt-8 flex flex-wrap gap-2 text-[12.5px] text-ink-2">
        {["Kein Passwort", "Kostenlos", "Ohne Kaution"].map((t) => (
          <li key={t} className="rounded-[6px] bg-paper-2 px-3 py-2 flex items-center gap-1.5 whitespace-nowrap"><IconCheck width={14} height={14} className="text-ok flex-none" />{t}</li>
        ))}
      </ul>
      <p className="text-[13px] text-muted mt-5 leading-relaxed">Mit der Anmeldung akzeptierst du die <a href="/nutzungsbedingungen" className="text-accent-hover hover:underline underline-offset-4">Nutzungsbedingungen</a> und die <a href="/regeln" className="text-accent-hover hover:underline underline-offset-4">Regeln</a>. Mindestalter 16 Jahre.</p>
    </div>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" /><path d="m11 12 8-8" /><path d="m16 7 2.5 2.5" /><path d="m14 9 2 2" />
    </svg>
  );
}
