import Link from "next/link";
import { cx } from "./ui";

/**
 * Bildmarke: fünf Buchrücken auf schwarzer Kachel, der letzte rot und angelehnt.
 * Dieselbe Kachel auf hellen und dunklen Flächen (Vektor, scharf in jeder Grösse).
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string; onDark?: boolean }) {
  return <img src="/brand/logo.svg" alt="" aria-hidden width={size} height={size} className={cx("block flex-none", className)} />;
}

export function Wordmark({ className = "", href = "/", label = "Leihregal, Start" }: { className?: string; href?: string; label?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-2.5 group", className)} aria-label={label}>
      <LogoMark size={30} className="transition-transform duration-base ease-spring group-hover:-rotate-6" />
      <span className="text-title-sm font-semibold leading-none tracking-display">Leihregal</span>
    </Link>
  );
}
