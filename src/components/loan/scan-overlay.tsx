"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Scanner } from "@/components/scanner";
import { Button, Input } from "@/components/ui";
import { IconClose } from "@/components/icons";

/** Code der anderen Person scannen – oder die sechs Ziffern eintippen (PRD 4.3). */
export function ScanOverlay({ loanId, label, onClose, onDone }: { loanId: string; label: string; onClose: () => void; onDone: (r: { waitingForOther?: boolean }) => void }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [onClose]);

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
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] bg-paper flex flex-col anim-sheet">
      <div className="flex items-center justify-between px-5 h-16 border-b border-line">
        <span className="font-serif text-xl">{label}</span>
        <button onClick={onClose} className="p-2 -mr-2" aria-label="Schliessen"><IconClose width={24} height={24} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 max-w-lg w-full mx-auto">
        <Scanner mode="qr" paused={busy} fallbackHint="Gib die sechs Ziffern unter dem Code ein."
          onResult={(text) => {
            const token = text.includes("/h/") ? text.split("/h/")[1] : text;
            redeem(() => api("/handover/redeem", { body: { token } }));
          }} />
        <form className="mt-8" onSubmit={(e) => { e.preventDefault(); redeem(() => api(`/loans/${loanId}/actions`, { body: { action: "enter_code", code: digits } })); }}>
          <label className="block text-sm font-medium mb-2" htmlFor="digits">Sechs Ziffern unter dem Code</label>
          <div className="flex gap-3">
            <Input id="digits" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} className="text-2xl tracking-[0.25em] tnum h-14 w-48" />
            <Button type="submit" variant="primary" size="lg" className="h-14" disabled={digits.length !== 6 || busy}>Bestätigen</Button>
          </div>
        </form>
        {error && <p className="text-late mt-4" role="alert">{error}</p>}
      </div>
    </div>
  );
}
