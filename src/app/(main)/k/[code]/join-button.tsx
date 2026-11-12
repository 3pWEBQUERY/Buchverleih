"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export function JoinButton({ code, circleId, approval }: { code: string; circleId: string; approval: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const t = CIRCLES[useLocale()].invite;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const r = await api<{ circleId: string; status: "active" | "pending" }>("/circles/join", { body: { code } });
      if (r.status === "active") {
        toast.show({ text: t.welcome }, 3000);
        router.push(`/kreise/${r.circleId ?? circleId}`);
      } else {
        setSent(true);
        setBusy(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  if (sent) return <p className="text-ink-2 anim-rise">{t.sent}</p>;
  return (
    <>
      <p className="text-ink-2 mb-6 max-w-sm mx-auto">
        {approval ? t.approvalText : t.linkText}
      </p>
      <Button variant="primary" size="lg" disabled={busy} onClick={join} className="w-full sm:w-auto">{approval ? t.ask : t.join}</Button>
    </>
  );
}
