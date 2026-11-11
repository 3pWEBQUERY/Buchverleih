"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/client";
import { IconClose } from "@/components/icons";

/**
 * Übergabe-Ansicht (PRD 4.3, 8.4): Vollbild-Code mit hoher Helligkeit, sechs Ziffern darunter,
 * funktioniert bei schwachem Netz (Code wird lokal gezeichnet). Bildschirm bleibt an.
 * Schliesst sich selbst, sobald die andere Person gescannt hat.
 */
type Token = { url: string; code: string; validUntil: string; direction: string };

export function HandoverCode({ loanId, label, onClose, onDone }: { loanId: string; label: string; onClose: () => void; onDone: () => void }) {
  const [token, setToken] = useState<Token | null>(null);
  const [svg, setSvg] = useState<string>("");
  const [left, setLeft] = useState(600);
  const [error, setError] = useState<string | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const t = await api<Token>(`/loans/${loanId}/actions`, { body: { action: "show_code" } });
      setToken(t);
      setSvg(await QRCode.toString(t.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loanId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      const s = Math.round((new Date(token.validUntil).getTime() - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) load();
    }, 1000);
    return () => clearInterval(t);
  }, [token, load]);

  // Bildschirm anlassen
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((w) => (wake.current = w)).catch(() => {});
    document.body.style.overflow = "hidden";
    return () => {
      wake.current?.release().catch(() => {});
      document.body.style.overflow = "";
    };
  }, []);

  // Sobald gescannt: Ereignis über Server-Sent Events
  useEffect(() => {
    const es = new EventSource(`/api/v1/stream?loan=${loanId}`);
    es.addEventListener("loan", () => onDone());
    return () => es.close();
  }, [loanId, onDone]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const mm = Math.max(0, Math.floor(left / 60));
  const ss = String(Math.max(0, left % 60)).padStart(2, "0");
  const pct = Math.max(0, Math.min(100, (left / 600) * 100));

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] bg-white text-black flex flex-col anim-sheet overflow-y-auto" style={{ colorScheme: "light" }}>
      <div className="flex items-center justify-between px-5 md:px-8 h-16 flex-none">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-500 inline-flex items-center gap-2">
          <span aria-hidden className="h-2 w-2 rounded-full bg-[#d23c1a] animate-pulse" /> Bildschirm bleibt an
        </span>
        <button onClick={onClose} className="h-11 w-11 -mr-2 grid place-items-center rounded-full hover:bg-neutral-100 transition-colors" aria-label="Schliessen"><IconClose width={24} height={24} /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
        <h2 className="text-[40px] md:text-[56px] leading-none tracking-[-0.03em]">{label}</h2>
        <p className="mt-3 text-[15px] text-neutral-600 max-w-xs">Halte den Bildschirm der anderen Person hin. Sie scannt ihn mit der Kamera.</p>
        {error ? (
          <p className="mt-10 text-center max-w-sm text-[17px]" role="alert">{error}</p>
        ) : !token ? (
          <div className="mt-8 w-[min(76vw,340px)] aspect-square rounded-[12px] bg-neutral-100 animate-pulse" />
        ) : (
          <>
            <div className="mt-8 p-4 rounded-[12px] border border-neutral-200 anim-pop">
              <div className="w-[min(68vw,320px)] aspect-square [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <p className="mt-8 text-[13px] text-neutral-600">Oder die sechs Ziffern eingeben</p>
            <p className="mt-3 flex items-center gap-2 md:gap-3" aria-label={`Code ${token.code.split("").join(" ")}`}>
              {token.code.split("").map((d, i) => (
                <span key={i} aria-hidden className={`h-14 w-11 md:h-16 md:w-12 grid place-items-center rounded-[10px] bg-neutral-100 font-sans text-[30px] md:text-[34px] font-semibold tnum ${i === 3 ? "ml-3 md:ml-4" : ""}`}>{d}</span>
              ))}
            </p>
            <div className="mt-8 w-[min(68vw,320px)]">
              <div className="h-1 rounded-full bg-neutral-200 overflow-hidden"><div className="h-full bg-black rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2.5 text-[13px] text-neutral-600 tnum">Gültig noch {mm}:{ss} Min. Danach erscheint automatisch ein neuer Code.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
