import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Grundkomponenten v2. Flach, klar, mit deutlicher Hierarchie. Keine Schatten. */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] select-none transition-[background-color,color,border-color,transform] duration-200 ease-[var(--ease-out-quart)] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  // Die Akzentfarbe gehört allein dem nächsten Schritt
  primary: "bg-accent text-accent-ink hover:bg-accent-hover rounded-full",
  secondary: "bg-ink text-paper hover:bg-ink-2 rounded-full",
  ghost: "text-ink border border-line-strong hover:border-ink hover:bg-paper-2 rounded-full",
  quiet: "text-muted font-medium hover:text-ink underline-offset-4 hover:underline",
  danger: "text-late font-medium hover:underline underline-offset-4",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13.5px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-base",
};

export function Button({ variant = "secondary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(base, variants[variant], variant !== "quiet" && variant !== "danger" && sizes[size], className)} {...p} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(base, variants[variant], variant !== "quiet" && variant !== "danger" && sizes[size], className)} {...p} />;
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[13px] font-semibold text-ink mb-2">{label}</span>
      {children}
      {hint && !error && <span className="block text-sm text-muted mt-1.5">{hint}</span>}
      {error && <span className="block text-sm text-late mt-1.5" role="alert">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full h-12 bg-paper border border-line-strong rounded-[10px] px-4 text-[16px] placeholder:text-muted/70 hover:border-ink-2 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-ink/10 transition-[border-color,box-shadow] duration-150";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...p} />;
}

export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <select className={cx(inputCls, "appearance-none pr-10 bg-[length:12px] bg-no-repeat bg-[right_14px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%236b6558' stroke-width='1.5'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E\")" }}
      {...p}>
      {children}
    </select>
  );
}

/** Auswahl als Reihe antippbarer Felder (Zustand, Leihfrist …) */
export function Segmented<T extends string | number>({
  value, onChange, options, name, className, size = "md",
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; hint?: string }[]; name: string; className?: string; size?: "md" | "lg" }) {
  return (
    <div role="radiogroup" aria-label={name} className={cx("grid gap-1 p-1 bg-paper-2 rounded-full", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} title={o.hint}
            onClick={() => onChange(o.value)}
            className={cx(
              "px-3 text-[13.5px] font-semibold rounded-full transition-[background-color,color] duration-200",
              size === "lg" ? "py-3" : "h-9",
              i < 0 && "",
              on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3",
            )}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex items-start justify-between gap-6 py-3 cursor-pointer", disabled && "opacity-50 pointer-events-none")}>
      <span>
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-sm text-muted mt-0.5">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-7 w-12 flex-none rounded-full transition-colors duration-200", checked ? "bg-ink" : "bg-paper-3")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-paper transition-[left] duration-300 ease-[var(--ease-spring)]", checked ? "left-6" : "left-1")} />
      </button>
    </label>
  );
}

export function Check({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string }) {
  return (
    <label className={cx("inline-flex items-center gap-2.5 cursor-pointer text-[15px]", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="appearance-none h-5 w-5 border-[1.5px] border-line-strong rounded-[5px] checked:bg-ink checked:border-ink grid place-content-center before:content-[''] before:w-2.5 before:h-1.5 before:border-l-2 before:border-b-2 before:border-paper before:-rotate-45 before:-translate-y-px before:scale-0 checked:before:scale-100 before:transition-transform" />
      {label}
    </label>
  );
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between gap-4 mb-6", className)}>
      <h2 className="ui-title text-[22px] md:text-[26px]">{children}</h2>
      {aside && <div className="text-sm font-medium text-muted">{aside}</div>}
    </div>
  );
}

export function PageTitle({ children, sub, aside }: { children: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 anim-rise">
        <h1 className="display text-[52px] md:text-[84px]">{children}</h1>
        {sub && <p className="text-ink-2 text-[17px] mt-4 max-w-xl">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Leerer Zustand: ein Satz und ein Knopf (PRD 8.1) */
export function Empty({ text, action }: { text: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel-quiet px-6 py-8 md:px-8 flex flex-wrap items-center justify-between gap-5">
      <p className="text-ink-2 text-[16px] max-w-lg">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "late" | "accent"; className?: string }) {
  return (
    <div className={cx("rounded-[10px] px-5 py-4 text-[15px] border-l-[3px]", tone === "late" ? "border-late bg-late/[0.07]" : tone === "accent" ? "border-accent bg-accent-soft/60" : "border-ink bg-paper-2", className)}>
      {children}
    </div>
  );
}

export function Dl({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx("divide-y divide-line border-y border-line", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-6 py-2.5 text-[15px]">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
