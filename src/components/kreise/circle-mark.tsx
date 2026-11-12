import { monogramColors } from "@/lib/monogram-colors";

/** Zeichen eines Kreises: Anfangsbuchstaben auf Buchleinen-Farbe, aus der Id abgeleitet */
export function CircleMark({ id, name, size = 48 }: { id: string; name: string; size?: number }) {
  const [bg, fg] = monogramColors(id);
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-hidden className="grid place-items-center flex-none font-serif leading-none"
      style={{ width: size, height: size, background: bg, color: fg, borderRadius: Math.round(size * 0.21), fontSize: Math.round(size * (letters.length > 1 ? 0.4 : 0.5)) }}>
      {letters || "?"}
    </span>
  );
}
