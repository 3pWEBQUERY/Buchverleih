"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui";
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
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] surface-night flex flex-col anim-sheet">
      <div className="flex items-center justify-between px-5 md:px-8 h-16 flex-none">
        <span className="text-[13px] font-medium text-night-muted">Kamera</span>
        <button onClick={onClose} className="h-11 w-11 -mr-2 grid place-items-center rounded-[8px] hover:bg-night-2 transition-colors" aria-label="Schliessen"><IconClose width={24} height={24} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8 max-w-lg w-full mx-auto">
        <h2 className="text-[30px] md:text-[38px] font-[560] leading-tight tracking-[-0.03em]">{label}</h2>
        <p className="mt-3 text-[15px] text-night-muted">Richte die Kamera auf den Code auf dem anderen Bildschirm.</p>
        <Scanner mode="qr" paused={busy} fallbackHint="Gib die sechs Ziffern unter dem Code ein." className="mt-6 !rounded-[10px] !border-night-line"
          onResult={(text) => {
            const token = text.includes("/h/") ? text.split("/h/")[1] : text;
            redeem(() => api("/handover/redeem", { body: { token } }));
          }} />
        <form className="mt-8 pt-6 border-t border-night-line" onSubmit={(e) => { e.preventDefault(); redeem(() => api(`/loans/${loanId}/actions`, { body: { action: "enter_code", code: digits } })); }}>
          <label className="block text-[13px] font-medium mb-2.5" htmlFor="digits">Oder die sechs Ziffern unter dem Code</label>
          <div className="flex flex-wrap gap-3">
            <input id="digits" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={digits} placeholder="000000"
              onChange={(e) => setDigits(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              className="h-14 w-52 rounded-[8px] bg-night-2 border border-night-line px-4 text-[24px] font-medium tracking-[0.3em] tnum text-night-ink placeholder:text-night-muted/40 focus:outline-none focus:border-night-ink transition-colors" />
            <Button type="submit" variant="primary" size="lg" className="h-14" disabled={digits.length !== 6 || busy}>Bestätigen</Button>
          </div>
        </form>
        {error && <p className="mt-4 text-[15px] text-[#ff8aa3]" role="alert">{error}</p>}
      </div>
    </div>
  );
}
