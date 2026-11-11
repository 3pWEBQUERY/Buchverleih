"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, LinkButton } from "@/components/ui";

export function Redeem({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ loanId: string }>("/handover/redeem", { body: { token } });
      router.replace(`/vorgaenge/${r.loanId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return error ? (
    <div className="mt-6"><p className="text-late">{error}</p><LinkButton href="/vorgaenge" className="mt-6">Zu den Vorgängen</LinkButton></div>
  ) : (
    <div className="mt-6">
      <p className="text-ink-2 mb-8">Bestätige, dass du das Buch jetzt in der Hand hast. Damit wechselt die Verantwortung.</p>
      <Button variant="primary" size="lg" onClick={go} disabled={busy} autoFocus>{busy ? "Einen Moment …" : "Erhalten, bestätigen"}</Button>
    </div>
  );
}
