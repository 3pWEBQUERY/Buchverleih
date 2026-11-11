"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";

/** «Auf die Wunschliste / Titelalarm» (PRD 4.6) */
export function WishButton({ workId, loggedIn, onList, alarm, next, primary, onNight = false }: { workId: string; loggedIn: boolean; onList: boolean; alarm: boolean; next: string; primary: boolean; onNight?: boolean }) {
  // Auf der dunklen Bühne ist der sekundäre Knopf hell gefüllt
  const nightCls = onNight && !primary ? "!bg-night-ink !text-night hover:!opacity-90" : undefined;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return <LinkButton href={`/anmelden?next=${encodeURIComponent(next)}`} variant={primary ? "primary" : "secondary"} className={nightCls}>Auf die Wunschliste</LinkButton>;
  }
  if (onList) {
    return (
      <Link href="/wunschliste" className={onNight
        ? "inline-flex h-11 items-center gap-2 px-5 rounded-full border border-night-line text-[15px] font-semibold hover:bg-night-2 transition-colors"
        : "inline-flex h-11 items-center gap-2 px-5 rounded-full border border-line-strong text-[15px] font-semibold hover:border-ink transition-colors"}>
        <span aria-hidden className={alarm ? "h-2 w-2 rounded-full bg-[#8fd09a] live-dot" : "h-2 w-2 rounded-full bg-current opacity-50"} />
        {alarm ? "Auf der Wunschliste, Titelalarm an" : "Auf der Wunschliste"}
      </Link>
    );
  }

  async function add() {
    setBusy(true);
    try {
      await api("/wishlist", { body: { workId } });
      router.refresh();
      toast.show({
        text: "Auf der Wunschliste. Der Titelalarm ist an.",
        undo: async () => {
          await api(`/wishlist?work=${workId}`, { method: "DELETE" });
          router.refresh();
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={primary ? "primary" : "secondary"} className={nightCls} onClick={add} disabled={busy}>
      Auf die Wunschliste
    </Button>
  );
}

/** «Versand gewünscht» zählt nur die Nachfrage (PRD 11.3) */
export function ShippingSignal() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <p className="text-sm text-muted" role="status">Danke, wir zählen das.</p>;
  return (
    <p className="text-sm text-muted">
      Zu weit weg?{" "}
      <button type="button" disabled={busy} className="underline underline-offset-4 hover:text-ink"
        onClick={async () => {
          setBusy(true);
          try {
            await api("/signals", { body: { key: "shipping" } });
          } catch {}
          setDone(true);
        }}>
        Versand gewünscht
      </button>
    </p>
  );
}
