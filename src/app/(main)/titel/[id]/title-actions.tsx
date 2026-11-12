"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";
import { useLocale } from "@/components/locale-provider";
import { TITLE } from "@/lib/i18n/messages/title";

/** «Auf die Wunschliste / Titelalarm» (PRD 4.6) */
export function WishButton({ workId, loggedIn, onList, alarm, next, primary, className }: { workId: string; loggedIn: boolean; onList: boolean; alarm: boolean; next: string; primary: boolean; className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const w = TITLE[useLocale()].wish;
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return <LinkButton href={`/anmelden?next=${encodeURIComponent(next)}`} variant={primary ? "primary" : "secondary"} className={className}>{w.add}</LinkButton>;
  }
  if (onList) {
    return (
      <Link href="/wunschliste" className={cx("inline-flex h-11 items-center justify-center gap-2 px-5 rounded-[6px] border border-line-strong text-[14.5px] font-medium hover:border-accent transition-colors", className)}>
        <span aria-hidden className={alarm ? "h-2 w-2 rounded-full bg-ok live-dot" : "h-2 w-2 rounded-full bg-done"} />
        {alarm ? w.onListAlarm : w.onList}
      </Link>
    );
  }

  async function add() {
    setBusy(true);
    try {
      await api("/wishlist", { body: { workId } });
      router.refresh();
      toast.show({
        text: w.added,
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
    <Button variant={primary ? "primary" : "secondary"} className={className} onClick={add} disabled={busy}>
      {w.add}
    </Button>
  );
}

/** «Versand gewünscht» zählt nur die Nachfrage (PRD 11.3) */
export function ShippingSignal() {
  const w = TITLE[useLocale()].wish;
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <p className="text-sm text-muted" role="status">{w.thanks}</p>;
  return (
    <p className="text-sm text-muted">
      {w.tooFar}{" "}
      <button type="button" disabled={busy} className="font-medium text-accent-hover hover:underline underline-offset-4"
        onClick={async () => {
          setBusy(true);
          try {
            await api("/signals", { body: { key: "shipping" } });
          } catch {}
          setDone(true);
        }}>
        {w.shipping}
      </button>
    </p>
  );
}
