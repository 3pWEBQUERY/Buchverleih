"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * Kamera im Browser (PRD 4.3, 7.1). Nutzt die eingebaute Strichcode-Erkennung, wo es sie gibt,
 * sonst eine eigene Erkennungsbibliothek als Rückfall (PRD 14: iOS Safari).
 * `mode="isbn"` liest EAN-13, `mode="qr"` liest QR-Codes.
 */
type Props = {
  mode: "isbn" | "qr";
  onResult: (text: string) => void;
  /** Serienmodus: nach einem Treffer weiterscannen (gleicher Code wird 3 s ignoriert) */
  continuous?: boolean;
  paused?: boolean;
  fallbackHint: string;
  className?: string;
};

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function Scanner({ mode, onResult, continuous, paused, fallbackHint, className }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const last = useRef<{ text: string; at: number } | null>(null);
  const pausedRef = useRef(paused);
  const cb = useRef(onResult);
  pausedRef.current = paused;
  cb.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let zxingControls: { stop: () => void } | null = null;
    let raf = 0;

    const hit = (text: string) => {
      if (pausedRef.current) return;
      const now = Date.now();
      if (last.current && last.current.text === text && now - last.current.at < 3000) return;
      last.current = { text, at: now };
      if (navigator.vibrate) navigator.vibrate(40);
      cb.current(text);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stop || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);

        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const formats = mode === "qr" ? ["qr_code"] : ["ean_13"];
        let native: Detector | null = null;
        if (BD) {
          try {
            const supported: string[] = await (BD as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats();
            if (formats.every((f) => supported.includes(f))) native = new BD({ formats });
          } catch {}
        }
        if (native) {
          const loop = async () => {
            if (stop) return;
            try {
              if (video.current && video.current.readyState >= 2) {
                const r = await native!.detect(video.current);
                if (r[0]?.rawValue) hit(r[0].rawValue);
              }
            } catch {}
            raf = window.setTimeout(loop, 180) as unknown as number;
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, mode === "qr" ? [BarcodeFormat.QR_CODE] : [BarcodeFormat.EAN_13]);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
          zxingControls = await reader.decodeFromVideoElement(video.current!, (res) => {
            if (res) hit(res.getText());
          });
        }
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? `Die Kamera ist blockiert. ${fallbackHint}`
            : `Die Kamera ist nicht verfügbar. ${fallbackHint}`,
        );
      }
    })();

    return () => {
      stop = true;
      clearTimeout(raf);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, fallbackHint]);

  if (error) {
    return <div className={cx("border border-line-strong rounded-sm p-5 text-[15px]", className)} role="alert">{error}</div>;
  }

  return (
    <div className={cx("relative overflow-hidden rounded-sm bg-black aspect-[4/3]", className)}>
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Kamera startet …</div>}
      {/* Zielrahmen */}
      <div aria-hidden className={cx("absolute border-2 border-white/90 rounded-sm", mode === "qr" ? "inset-[18%] aspect-square mx-auto" : "left-[12%] right-[12%] top-[32%] bottom-[32%]")}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--accent)]" style={{ animation: "scan-line 1.6s ease-in-out infinite alternate" }} />
      </div>
      {paused && <div className="absolute inset-0 bg-black/40" />}
    </div>
  );
}
