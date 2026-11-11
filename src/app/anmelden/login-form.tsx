"use client";
import { useState } from "react";
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
      router.replace(next ?? "/");
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (!/abort|cancel|NotAllowed/i.test(msg)) setError(msg);
    }
  }

  if (sent) {
    return (
      <div className="panel-quiet rounded-[18px] p-6 md:p-7 anim-rise" aria-live="polite">
        <span className="h-12 w-12 rounded-full bg-ink text-paper grid place-items-center anim-pop"><IconCheck width={22} height={22} /></span>
        <p className="font-serif text-[34px] leading-none mt-5">Schau in dein Postfach.</p>
        <p className="text-ink-2 mt-3">Wir haben einen Link an <strong className="font-semibold text-ink break-all">{email}</strong> geschickt. Er gilt 20 Minuten.</p>
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
      <Button variant="ghost" size="lg" className="w-full" onClick={passkey}>
        <IconKey /> Mit Passkey anmelden
      </Button>
      <p className="text-[13px] text-muted mt-8 leading-relaxed">Mit der Anmeldung akzeptierst du die <a href="/nutzungsbedingungen" className="underline underline-offset-4 hover:text-ink">Nutzungsbedingungen</a> und die <a href="/regeln" className="underline underline-offset-4 hover:text-ink">Regeln</a>. Mindestalter 16 Jahre.</p>
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
