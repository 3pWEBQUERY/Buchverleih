import Link from "next/link";
import { cx } from "./ui";

/** Bildmarke: drei Buchrücken, der letzte lehnt sich an – einer davon in der Akzentfarbe. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={className}>
      <rect x="4" y="7" width="5.5" height="21" rx="1" fill="currentColor" />
      <rect x="11" y="4" width="5.5" height="24" rx="1" fill="var(--accent)" />
      <rect x="20.2" y="7.4" width="5.5" height="21" rx="1" fill="currentColor" transform="rotate(14 23 28)" />
      <rect x="2" y="28.5" width="28" height="1.8" rx="0.9" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-2.5 group", className)} aria-label="Leihregal, Start">
      <LogoMark className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6" />
      <span className="text-[21px] font-[620] leading-none tracking-[-0.04em]">Leihregal</span>
    </Link>
  );
}
