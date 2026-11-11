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
    <div className="rounded-[10px] border border-line p-4">
      <p className="text-[13px] text-muted mb-3">Stimmt etwas nicht?</p>
      <div className="grid grid-cols-2 gap-2">
        {reported ? (
          <span className="h-10 rounded-[6px] bg-paper-2 text-muted text-[13.5px] inline-flex items-center justify-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-done" />Gemeldet</span>
        ) : (
          <Button variant="secondary" size="sm" className="!h-10" aria-expanded={reporting} aria-controls="melden-gruende" onClick={() => setReporting((r) => !r)}>
            Melden
          </Button>
        )}
        {blocked ? (
          <Button variant="quiet" size="sm" className="!h-10" disabled={busy} onClick={() => unblock().catch((e) => toast.error((e as Error).message))}>
            Aufheben
          </Button>
        ) : (
          <button type="button" disabled={busy} onClick={block}
            className="h-10 rounded-[6px] border border-late/40 text-late text-[13.5px] font-medium hover:bg-late hover:text-paper hover:border-late transition-colors disabled:opacity-45">
            Blockieren
          </button>
        )}
      </div>
      {reporting && (
        <div id="melden-gruende" className="anim-rise mt-3 pt-3 border-t border-line">
          <p className="text-[13px] font-medium mb-2">Was ist das Problem?</p>
          <div className="flex flex-col gap-1">
            {REASONS.map((r) => (
              <button key={r} type="button" disabled={busy} onClick={() => report(r)}
                className="h-9 px-3 rounded-[6px] text-left text-[13.5px] hover:bg-accent-soft hover:text-accent-hover transition-colors disabled:opacity-45">
                {reportReasonLabel[r]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
