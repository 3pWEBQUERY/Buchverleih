"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { api } from "@/lib/client";
import { Button, Field, Input } from "@/components/ui";

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
      <div className="anim-rise border-t border-line pt-6">
        <p className="font-serif text-2xl">Schau in dein Postfach.</p>
        <p className="text-ink-2 mt-2">Wir haben einen Link an <strong className="font-medium">{email}</strong> geschickt. Er gilt 20 Minuten.</p>
        {sent.devLink && (
          <p className="mt-6 text-sm border-l-2 border-accent pl-4">
            Testumgebung ohne Mailversand: <a className="underline underline-offset-4 break-all" href={sent.devLink}>Anmeldelink öffnen</a>
          </p>
        )}
        <button className="mt-8 text-sm text-muted underline underline-offset-4" onClick={() => setSent(null)}>Andere Adresse verwenden</button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-Mail-Adresse" error={error}>
          <Input type="email" required autoComplete="email webauthn" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.ch" />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Wird gesendet …" : "Anmeldelink senden"}
        </Button>
      </form>
      <div className="flex items-center gap-4 my-8 text-sm text-muted">
        <span className="h-px flex-1 bg-line" /> oder <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={passkey}>Mit Passkey anmelden</Button>
      <p className="text-sm text-muted mt-8">Mit der Anmeldung akzeptierst du die <a href="/nutzungsbedingungen" className="underline underline-offset-4">Nutzungsbedingungen</a> und die <a href="/regeln" className="underline underline-offset-4">Regeln</a>. Mindestalter 16 Jahre.</p>
    </div>
  );
}
