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

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] bg-white text-black flex flex-col anim-sheet" style={{ colorScheme: "light" }}>
      <div className="flex items-center justify-between px-5 h-16">
        <span className="font-serif text-xl">{label}</span>
        <button onClick={onClose} className="p-2 -mr-2" aria-label="Schliessen"><IconClose width={24} height={24} /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {error ? (
          <p className="text-center max-w-sm text-[17px]">{error}</p>
        ) : !token ? (
          <div className="w-[min(78vw,360px)] aspect-square bg-neutral-100 animate-pulse" />
        ) : (
          <>
            <div className="w-[min(78vw,360px)] aspect-square [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-8 text-sm text-neutral-600">Oder die sechs Ziffern eingeben</p>
            <p className="mt-2 font-sans text-5xl tracking-[0.18em] tnum font-medium" aria-label={`Code ${token.code.split("").join(" ")}`}>
              {token.code.slice(0, 3)}<span className="inline-block w-4" />{token.code.slice(3)}
            </p>
            <p className="mt-6 text-sm text-neutral-600 tnum">Gültig noch {mm}:{ss} Min. Danach erscheint automatisch ein neuer Code.</p>
          </>
        )}
      </div>
    </div>
  );
}
