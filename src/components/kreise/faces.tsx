import { cx } from "@/components/ui";
import { monogramColors } from "@/components/person/monogram";

/** Auf dunkler Fläche: helle Töne, damit sich die Initialen abheben */
const NIGHT_TONES = ["bg-night-ink text-night", "bg-night-muted text-night"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Initiale auf Buchleinen-Farbe wie das Monogramm – dieselbe Person sieht überall gleich aus */
export function Avatar({ name, seed, size = 40, className, night }: { name: string; seed?: string; size?: number; className?: string; night?: boolean }) {
  const [bg, fg] = monogramColors(seed ?? name);
  return (
    <span aria-hidden className={cx("grid place-items-center rounded-full font-semibold tracking-[-0.02em] leading-none flex-none select-none", night && NIGHT_TONES[hash(name) % NIGHT_TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), ...(night ? {} : { background: bg, color: fg }) }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Überlappende Initialen, dazu «+n», wenn es mehr Mitglieder gibt */
export function Faces({ names, seeds, total, size = 34, ring = "ring-paper", night }: { names: string[]; seeds?: string[]; total: number; size?: number; ring?: string; night?: boolean }) {
  const more = total - names.length;
  return (
    <span className="flex items-center" aria-label={`${total} ${total === 1 ? "Mitglied" : "Mitglieder"}: ${names.join(", ")}${more > 0 ? " und weitere" : ""}`}>
      {names.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} seed={seeds?.[i]} size={size} night={night} className={cx("ring-[2.5px]", ring, i > 0 && "-ml-2.5")} />
      ))}
      {more > 0 && (
        <span aria-hidden className={cx("-ml-2.5 grid place-items-center rounded-full", night ? "bg-night-2 text-night-ink" : "bg-paper-2 text-ink-2", " text-[12px] font-semibold tnum ring-[2.5px]", ring)} style={{ width: size, height: size }}>
          +{more}
        </span>
      )}
    </span>
  );
}
