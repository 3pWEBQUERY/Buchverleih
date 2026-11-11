"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, LinkButton } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";

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
      <div className="panel-quiet rounded-[14px] p-6 anim-rise" role="alert">
        <p className="ui-title text-[18px]">Der Link funktioniert nicht mehr.</p>
        <p className="text-ink-2 mt-1.5">{error}</p>
        <LinkButton href="/anmelden" variant="primary" className="mt-6">Neuen Link anfordern</LinkButton>
      </div>
    );
  return (
    <div className="anim-rise" style={{ animationDelay: "60ms" }}>
      <p className="text-ink-2 text-[17px] mb-8">Ein Tipp, und du bist angemeldet.</p>
      <Button variant="primary" size="lg" className="w-full" onClick={go} disabled={busy || !token} autoFocus>
        {busy ? "Einen Moment …" : <>Jetzt anmelden <IconArrowRight width={18} height={18} /></>}
      </Button>
      {!token && <p className="text-sm text-late mt-4">Dem Link fehlt ein Teil. Fordere auf der Anmeldeseite einen neuen an.</p>}
      <p className="text-sm text-muted mt-8">Andere Adresse? <a href="/anmelden" className="underline underline-offset-4 hover:text-ink">Neuen Link anfordern</a></p>
    </div>
  );
}
