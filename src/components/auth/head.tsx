import type { ReactNode } from "react";

/** Kopf der Formularspalte */
export function AuthHead({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-9 anim-rise">
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h1 className="display text-[32px] md:text-[44px]">{title}</h1>
      {children && <p className="text-ink-2 text-[16px] md:text-[17px] leading-relaxed mt-4">{children}</p>}
    </header>
  );
}
