"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";
import { reportReasonLabel } from "@/lib/i18n/de-CH";

const REASONS = ["harassment", "commercial", "inappropriate", "fake", "other"] as const;

/**
 * Melden und Blockieren mit einem Tipp (PRD 6.5). Blockieren wirkt sofort und lässt
 * sich im Hinweis rückgängig machen – kein Bestätigungsdialog (PRD 8.2).
 */
export function ProfileActions({ userId, name, blocked }: { userId: string; name: string; blocked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unblock(silent = false) {
    await api(`/blocks?user=${userId}`, { method: "DELETE" });
    router.refresh();
    if (!silent) toast.show({ text: `${name} ist nicht mehr blockiert.` });
  }

  async function block() {
    setBusy(true);
    try {
      await api("/blocks", { body: { userId } });
      router.refresh();
      toast.show({ text: `${name} ist blockiert und sieht dein Regal nicht mehr.`, undo: () => unblock(true) }, 7000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function report(reason: (typeof REASONS)[number]) {
    setBusy(true);
    try {
      await api("/reports", { body: { targetType: "user", targetId: userId, reason } });
      setReporting(false);
      setReported(true);
      toast.show({ text: "Danke. Die Moderation sieht sich das an." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap items-center md:justify-end gap-x-5 gap-y-2 text-sm">
        {reported ? (
          <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-done" />Gemeldet</span>
        ) : (
          <Button variant="ghost" size="sm" aria-expanded={reporting} aria-controls="melden-gruende" onClick={() => setReporting((r) => !r)}>
            Melden
          </Button>
        )}
        {blocked ? (
          <Button variant="quiet" className="text-sm" disabled={busy} onClick={() => unblock().catch((e) => toast.error((e as Error).message))}>
            Blockierung aufheben
          </Button>
        ) : (
          <Button variant="danger" className="text-sm" disabled={busy} onClick={block}>Blockieren</Button>
        )}
      </div>
      {reporting && (
        <div id="melden-gruende" className="anim-rise mt-3 panel-quiet p-4 sm:max-w-sm md:ml-auto">
          <p className="text-[13px] font-semibold mb-2.5">Was ist das Problem?</p>
          <div className="flex flex-wrap md:justify-end gap-2">
            {REASONS.map((r) => (
              <Button key={r} variant="ghost" size="sm" className="bg-paper" disabled={busy} onClick={() => report(r)}>
                {reportReasonLabel[r]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
