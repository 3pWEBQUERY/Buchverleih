"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";

export function JoinButton({ code, circleId, approval }: { code: string; circleId: string; approval: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const r = await api<{ circleId: string; status: "active" | "pending" }>("/circles/join", { body: { code } });
      if (r.status === "active") {
        toast.show({ text: "Willkommen im Kreis." }, 3000);
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

  if (sent) return <p className="text-ink-2 anim-rise">Deine Anfrage ist gesendet. Sobald ein Admin dich freigibt, erhältst du eine Nachricht.</p>;
  return (
    <>
      <p className="text-ink-2 mb-6 max-w-sm mx-auto">
        {approval ? "Die Admins sehen deine Anfrage und geben dich frei." : "Du siehst danach das gemeinsame Regal und kannst eigene Bücher dazustellen."}
      </p>
      <Button variant="primary" size="lg" disabled={busy} onClick={join} className="w-full sm:w-auto">{approval ? "Beitritt anfragen" : "Beitreten"}</Button>
    </>
  );
}
