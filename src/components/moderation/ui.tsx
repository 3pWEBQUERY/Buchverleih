import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";

/** Bausteine des internen Moderations-Dashboards (Server-Komponenten). */

export type Tone = "late" | "lent" | "wait" | "ok" | "done";
const dot: Record<Tone, string> = { late: "bg-late", lent: "bg-lent", wait: "bg-wait", ok: "bg-ok", done: "bg-done" };
const tint: Record<Tone, string> = { late: "!bg-late/10 !text-late", lent: "!bg-lent/10 !text-lent", wait: "!bg-wait/10 !text-wait", ok: "!bg-ok/10 !text-ok", done: "" };

/** Status-Chip: Punkt + Text, nie nur Farbe */
export function Chip({ tone = "done", strong, children, className }: { tone?: Tone; strong?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx("chip", strong && tint[tone], className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full flex-none", dot[tone])} />
      {children}
    </span>
  );
}

export type Priority = "hoch" | "mittel" | "normal" | "niedrig";
const prio: Record<Priority, [string, Tone, boolean]> = {
  hoch: ["Priorität hoch", "late", true],
  mittel: ["Priorität mittel", "lent", true],
  normal: ["Läuft automatisch", "wait", false],
  niedrig: ["Priorität niedrig", "done", false],
};
export function PriorityChip({ p }: { p: Priority }) {
  const [label, tone, strong] = prio[p];
  return <Chip tone={tone} strong={strong}>{label}</Chip>;
}

/** Abschnittskopf mit Zähler */
export function ModHead({ title, count, aside, id }: { title: ReactNode; count?: number; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
      <h2 id={id} className="text-[20px] md:text-[22px] font-[560] tracking-[-0.025em] flex items-center gap-2.5">
        {title}
        {count !== undefined && (
          <span className={cx("inline-grid place-items-center h-7 min-w-7 px-2 rounded-[6px] text-[13px] font-semibold tnum", count > 0 ? "bg-accent-soft text-accent-hover" : "bg-paper-2 text-muted")}>{count}</span>
        )}
      </h2>
      {aside && <div className="hidden sm:block text-sm text-muted text-right">{aside}</div>}
    </div>
  );
}

/** Ruhiger Hinweis, wenn eine Liste leer ist */
export function Quiet({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-dashed border-line-strong px-5 py-4 text-ink-2 text-[15px]">{children}</p>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
      <IconArrowLeft width={16} height={16} /> {children}
    </Link>
  );
}

/** Kennzahl als Kachel mit grosser Serif-Zahl */
export function StatTile({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[8px] bg-paper-2 px-4 py-3", className)}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="font-[560] tracking-[-0.04em] text-[24px] md:text-[28px] leading-none tnum mt-1.5">{value}</dd>
      {sub && <dd className="text-[12.5px] text-muted mt-1.5">{sub}</dd>}
    </div>
  );
}
