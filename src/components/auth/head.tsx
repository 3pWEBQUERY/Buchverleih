import type { ReactNode } from "react";

/** Kopf der Formularspalte */
export function AuthHead({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 anim-rise">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="display text-[32px] md:text-[44px]">{title}</h1>
      {children && <p className="text-ink-2 text-[15.5px] md:text-[16px] leading-relaxed mt-3">{children}</p>}
    </header>
  );
}
