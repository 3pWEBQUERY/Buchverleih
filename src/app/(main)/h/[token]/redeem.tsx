"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, LinkButton } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { LOANS } from "@/lib/i18n/messages/loans";

export function Redeem({ token }: { token: string }) {
  const router = useRouter();
  const t = LOANS[useLocale()].redeem;
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
    <div className="mt-6"><p className="text-late" role="alert">{error}</p><LinkButton href="/vorgaenge" className="mt-6">{t.toLoans}</LinkButton></div>
  ) : (
    <div className="mt-6">
      <p className="text-ink-2 text-[16px] mb-8 max-w-xs mx-auto">{t.text}</p>
      <Button variant="primary" size="lg" onClick={go} disabled={busy} autoFocus className="w-full">{busy ? t.wait : t.confirm}</Button>
    </div>
  );
}
