import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Grundkomponenten. Flach, feine Linien, kleine Rundungen. */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium select-none transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  // Die Akzentfarbe gehört allein dem nächsten Schritt
  primary: "bg-accent text-accent-ink hover:bg-accent-hover rounded-sm",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-paper rounded-sm",
  ghost: "text-ink hover:bg-paper-3 rounded-sm",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline",
  danger: "text-late hover:underline underline-offset-4",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
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
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-sm text-muted mt-1.5">{hint}</span>}
      {error && <span className="block text-sm text-late mt-1.5" role="alert">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full h-11 bg-transparent border border-line-strong rounded-sm px-3 text-[16px] placeholder:text-muted/70 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-colors";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...p} />;
}

export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <select className={cx(inputCls, "appearance-none pr-9 bg-[length:12px] bg-no-repeat bg-[right_12px_center]", className)}
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
    <div role="radiogroup" aria-label={name} className={cx("grid border border-line-strong rounded-sm overflow-hidden", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} title={o.hint}
            onClick={() => onChange(o.value)}
            className={cx(
              "px-2 text-sm transition-colors duration-150",
              size === "lg" ? "py-3" : "h-10",
              i > 0 && "border-l border-line-strong",
              on ? "bg-ink text-paper" : "hover:bg-paper-3",
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
        className={cx("relative mt-0.5 h-6 w-10 flex-none rounded-full border transition-colors duration-150", checked ? "bg-ink border-ink" : "bg-transparent border-line-strong")}>
        <span className={cx("absolute top-[3px] h-4 w-4 rounded-full transition-[left,background-color] duration-150", checked ? "left-[19px] bg-paper" : "left-[3px] bg-line-strong")} />
      </button>
    </label>
  );
}

export function Check({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string }) {
  return (
    <label className={cx("inline-flex items-center gap-2.5 cursor-pointer text-[15px]", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="appearance-none h-[18px] w-[18px] border border-line-strong rounded-xs checked:bg-ink checked:border-ink grid place-content-center before:content-[''] before:w-2.5 before:h-1.5 before:border-l-2 before:border-b-2 before:border-paper before:-rotate-45 before:-translate-y-px before:scale-0 checked:before:scale-100 before:transition-transform" />
      {label}
    </label>
  );
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 border-b border-line pb-2 mb-5", className)}>
      <h2 className="text-xl md:text-2xl">{children}</h2>
      {aside && <div className="text-sm text-muted">{aside}</div>}
    </div>
  );
}

export function PageTitle({ children, sub, aside }: { children: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-8 md:mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-4xl md:text-6xl">{children}</h1>
        {sub && <p className="text-muted mt-3 max-w-xl">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Leerer Zustand: ein Satz und ein Knopf (PRD 8.1) */
export function Empty({ text, action }: { text: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-10 border-y border-line flex flex-wrap items-center justify-between gap-4">
      <p className="text-ink-2">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "late" | "accent"; className?: string }) {
  return (
    <div className={cx("border-l-2 pl-4 py-1 text-[15px]", tone === "late" ? "border-late" : tone === "accent" ? "border-accent" : "border-line-strong", className)}>
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
