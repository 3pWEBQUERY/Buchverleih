import { cx } from "@/components/ui";

/** Ruhige Flächenfarben aus den Tokens – abgeleitet vom Namen */
const TONES = ["bg-ink text-paper", "bg-paper-3 text-ink", "bg-night-2 text-night-ink", "bg-accent-soft text-ink"];
/** Auf dunkler Fläche: helle Töne, damit sich die Initialen abheben */
const NIGHT_TONES = ["bg-night-ink text-night", "bg-night-muted text-night"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Avatar({ name, size = 40, className, night }: { name: string; size?: number; className?: string; night?: boolean }) {
  const tones = night ? NIGHT_TONES : TONES;
  return (
    <span aria-hidden className={cx("grid place-items-center rounded-full font-semibold tracking-[-0.02em] leading-none flex-none select-none", tones[hash(name) % tones.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Überlappende Initialen, dazu «+n», wenn es mehr Mitglieder gibt */
export function Faces({ names, total, size = 34, ring = "ring-paper", night }: { names: string[]; total: number; size?: number; ring?: string; night?: boolean }) {
  const more = total - names.length;
  return (
    <span className="flex items-center" aria-label={`${total} ${total === 1 ? "Mitglied" : "Mitglieder"}: ${names.join(", ")}${more > 0 ? " und weitere" : ""}`}>
      {names.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} night={night} className={cx("ring-[2.5px]", ring, i > 0 && "-ml-2.5")} />
      ))}
      {more > 0 && (
        <span aria-hidden className={cx("-ml-2.5 grid place-items-center rounded-full", night ? "bg-night-2 text-night-ink" : "bg-paper-2 text-ink-2", " text-[12px] font-semibold tnum ring-[2.5px]", ring)} style={{ width: size, height: size }}>
          +{more}
        </span>
      )}
    </span>
  );
}
