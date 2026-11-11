import { cx } from "@/components/ui";

/**
 * Monogramm einer Person: Serif-Initiale auf einer Buchleinen-Farbe. Die Farbe ergibt sich
 * deterministisch aus der Id – dieselbe Person sieht überall gleich aus. Kein Foto, kein Abzeichen.
 */
const CLOTH: [bg: string, fg: string][] = [
  ["#22324a", "#efe6d2"],
  ["#2e4a3b", "#eee4cc"],
  ["#6d2b2a", "#f3e7d3"],
  ["#b8902f", "#1f1b12"],
  ["#4b2e44", "#f1e4d8"],
  ["#2b5a5b", "#eef0e4"],
  ["#9e4c2f", "#f6ead8"],
  ["#55624a", "#f0e9d6"],
  ["#384a6b", "#eee6d6"],
  ["#8c2f39", "#f3e3cf"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function monogramColors(seed: string) {
  return CLOTH[hash(seed) % CLOTH.length];
}

export function Monogram({ name, seed, size = 48, className }: { name: string; seed: string; size?: number; className?: string }) {
  const [bg, fg] = monogramColors(seed);
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
