import { brandPair, monogramColors } from "@/lib/monogram-colors";
import { imageUrl } from "@/components/cover";

/**
 * Zeichen eines Kreises: Anfangsbuchstaben auf Buchleinen-Farbe, aus der Id abgeleitet.
 * Kreise von Organisationen können eine eigene Farbe und ein Logo setzen.
 */
export function CircleMark({ id, name, size = 48, color, logo }: { id: string; name: string; size?: number; color?: string | null; logo?: string | null }) {
  if (logo) {
    return (
      <img src={imageUrl(logo)} alt="" aria-hidden width={size} height={size} className="flex-none object-cover bg-paper-2"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.21) }} />
    );
  }
  const [bg, fg] = color ? brandPair(color) : monogramColors(id);
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-hidden className="grid place-items-center flex-none font-serif leading-none"
      style={{ width: size, height: size, background: bg, color: fg, borderRadius: Math.round(size * 0.21), fontSize: Math.round(size * (letters.length > 1 ? 0.4 : 0.5)) }}>
      {letters || "?"}
    </span>
  );
}
