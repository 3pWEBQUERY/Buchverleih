"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, LinkButton } from "@/components/ui";

export function VerifyLink({ token, next }: { token: string; next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ created: boolean }>("/auth/email/verify", { body: { token } });
      router.replace(r.created ? `/willkommen${next ? `?next=${encodeURIComponent(next)}` : ""}` : next ?? "/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="mt-6">
        <p className="text-late">{error}</p>
        <LinkButton href="/anmelden" className="mt-6">Neuen Link anfordern</LinkButton>
      </div>
    );
  return (
    <div className="mt-6">
      <p className="text-ink-2 mb-8">Ein Tipp, und du bist angemeldet.</p>
      <Button variant="primary" size="lg" onClick={go} disabled={busy || !token} autoFocus>{busy ? "Einen Moment …" : "Jetzt anmelden"}</Button>
    </div>
  );
}
