"use client";
import { useState } from "react";
import { Modal, ModalClose } from "@/components/modal";
import { api } from "@/lib/client";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui";
import { IconClose } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { CHAT } from "@/lib/i18n/messages/loans-chat";

/** Code der anderen Person scannen – oder die sechs Ziffern eintippen (PRD 4.3). */
export function ScanOverlay({ loanId, label, onClose, onDone }: { loanId: string; label: string; onClose: () => void; onDone: (r: { waitingForOther?: boolean }) => void }) {
  const t = CHAT[useLocale()].scan;
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function redeem(fn: () => Promise<{ waitingForOther?: boolean }>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await fn());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal label={label} onClose={onClose} className="surface-night flex flex-col">
      <div className="flex items-center justify-between px-5 md:px-8 h-16 flex-none">
        <span className="text-meta font-medium text-night-muted">{t.camera}</span>
        <ModalClose className="press h-11 w-11 -mr-2 grid place-items-center rounded-md hover:bg-night-2 transition-colors" label={t.close}><IconClose width={24} height={24} /></ModalClose>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8 max-w-lg w-full mx-auto">
        <h2 className="text-display font-title leading-tight tracking-title">{label}</h2>
        <p className="mt-3 text-body text-night-muted">{t.aim}</p>
        <Scanner mode="qr" paused={busy} fallbackHint={t.fallback} className="mt-6 !rounded-md !border-night-line"
          onResult={(text) => {
            const token = text.includes("/h/") ? text.split("/h/")[1] : text;
            redeem(() => api("/handover/redeem", { body: { token } }));
          }} />
        <form className="mt-8 pt-6 border-t border-night-line" onSubmit={(e) => { e.preventDefault(); redeem(() => api(`/loans/${loanId}/actions`, { body: { action: "enter_code", code: digits } })); }}>
          <label className="block text-meta font-medium mb-2.5" htmlFor="digits">{t.orDigits}</label>
          <div className="flex flex-wrap gap-3">
            <input id="digits" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={digits} placeholder="000000"
              onChange={(e) => setDigits(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              className="h-14 w-52 rounded-md bg-night-2 border border-night-line px-4 text-title font-medium tracking-code tnum text-night-ink placeholder:text-night-muted/40 focus:outline-none focus:border-night-ink transition-colors" />
            <Button type="submit" variant="primary" size="lg" className="h-14" disabled={digits.length !== 6 || busy}>{t.confirm}</Button>
          </div>
        </form>
        {error && <p className="mt-4 text-body text-night-late" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
