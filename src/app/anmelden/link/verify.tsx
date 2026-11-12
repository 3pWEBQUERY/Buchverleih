"use client";
import { useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, LinkButton } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { ONBOARDING } from "@/lib/i18n/messages/onboarding";

export function VerifyLink({ token, next }: { token: string; next: string | null }) {
  const router = useRouter();
  const t = ONBOARDING[useLocale()].link;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ created: boolean }>("/auth/email/verify", { body: { token } });
      router.replace(r.created ? `/willkommen${safeNext(next) ? `?next=${encodeURIComponent(safeNext(next))}` : ""}` : safeNext(next) || "/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="panel-quiet rounded-[8px] p-6 anim-rise" role="alert">
        <p className="ui-title text-[18px]">{t.broken}</p>
        <p className="text-ink-2 mt-1.5">{error}</p>
        <LinkButton href="/anmelden" variant="primary" className="mt-6">{t.newLink}</LinkButton>
      </div>
    );
  return (
    <div className="anim-rise" style={{ animationDelay: "60ms" }}>
      <p className="text-ink-2 text-[17px] mb-8">{t.oneTap}</p>
      <Button variant="primary" size="lg" className="w-full" onClick={go} disabled={busy || !token} autoFocus>
        {busy ? t.moment : <>{t.go} <IconArrowRight width={18} height={18} /></>}
      </Button>
      {!token && <p className="text-sm text-late mt-4">{t.missing}</p>}
      <p className="text-sm text-muted mt-8">{t.otherAddress}<a href="/anmelden" className="underline underline-offset-4 hover:text-ink">{t.newLink}</a></p>
    </div>
  );
}
