import type { ReactNode } from "react";

/**
 * Leerer Zustand mit Foto (Higgsfield, Bildsprache des Regals): breit steht der Text auf der freien Wand
 * links, das Motiv rechts; schmal steht das Foto oben und der Text darunter auf Wandgrau.
 * `src` ist der Basisname unter /shelf/ (z. B. "leer-vorgaenge"), es gibt ihn in 2400 und 1200 px.
 */
export function PhotoCard({ src, eyebrow, title, children, actions, className = "" }: {
  src: string;
  eyebrow?: ReactNode;
  /** Überschrift in zwei Teilen: der zweite wird zurückgenommen gesetzt */
  title: readonly string[];
  children?: ReactNode;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-lg bg-[#3b3b3b] text-night-ink anim-rise ${className}`}>
      <picture>
        <source media="(min-width: 768px)" srcSet={`/shelf/${src}.webp`} />
        <img src={`/shelf/${src}-1200.webp`} alt="" aria-hidden width={1200} height={514} decoding="async"
          className="block w-full h-[200px] sm:h-[260px] object-cover object-[78%_50%] md:absolute md:inset-0 md:h-full md:object-[20%_50%]" />
      </picture>
      <div className="relative p-7 md:p-12 md:min-h-[400px] flex flex-col justify-center md:max-w-[52%]">
        {eyebrow && <p className="eyebrow !text-night-muted">{eyebrow}</p>}
        <h2 className="display text-display mt-3 max-w-[12ch]">{title[0]}<em className="text-night-muted">{title[1]}</em></h2>
        {children && <div className="mt-4 text-body text-night-muted max-w-md">{children}</div>}
        <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}
