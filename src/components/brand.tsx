import Link from "next/link";
import { cx } from "./ui";

/**
 * Bildmarke: das «B» mit dem offenen Buch. Im Light Mode schwarz mit oranger Seite,
 * im Dark Mode weiss mit oranger Seite. Auf dunklen Flächen (`onDark`) immer die helle Variante.
 */
export function LogoMark({ size = 28, className, onDark }: { size?: number; className?: string; onDark?: boolean }) {
   
  if (onDark) return <img src="/brand/logo-dark.png" alt="" aria-hidden width={size} height={size} className={cx("block flex-none", className)} />;
  return (
    <span aria-hidden className={cx("relative inline-block flex-none", className)} style={{ width: size, height: size }}>
      <img src="/brand/logo-light.png" alt="" width={size} height={size} className="logo-light block" />
      <img src="/brand/logo-dark.png" alt="" width={size} height={size} className="logo-dark absolute inset-0" />
    </span>
  );
   
}

export function Wordmark({ className = "", href = "/", label = "Leihregal, Start" }: { className?: string; href?: string; label?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-2.5 group", className)} aria-label={label}>
      <LogoMark size={30} className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6" />
      <span className="text-[21px] font-[620] leading-none tracking-[-0.04em]">Leihregal</span>
    </Link>
  );
}
