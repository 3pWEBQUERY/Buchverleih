"use client";
import { useState } from "react";
import { cx } from "@/components/ui";
import { monogramColors } from "@/lib/monogram-colors";

/**
 * Monogramm einer Person: Serif-Initiale auf einer Buchleinen-Farbe, die Farbe deterministisch aus der Id.
 * Profilbild statt Initiale, wenn eines hochgeladen wurde (liegt im Bucket, ausgeliefert über /api/v1/images) */
export function Monogram({ name, seed, size = 48, className, photo }: { name: string; seed: string; size?: number; className?: string; photo?: string | null }) {
  const [bg, fg] = monogramColors(seed);
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/v1/images/${photo}${size <= 160 ? "?w=480" : ""}`} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async"
        className={cx("rounded-full flex-none object-cover select-none", className)} style={{ width: size, height: size, background: bg }}
        onError={() => setBroken(true)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cx("inline-grid place-items-center rounded-full flex-none font-semibold tracking-[-0.02em] leading-none select-none", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.52) }}
    >
      <span style={{ transform: "translateY(4%)" }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>
    </span>
  );
}
