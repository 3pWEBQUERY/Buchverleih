"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

/**
 * Bausteine des Motion-Systems (README «Designsystem»). Alles läuft über CSS-Klassen aus
 * globals.css und die Web Animations API – keine Animationsbibliothek.
 */

/** Hält ein Element während seines Austritts im DOM (Klasse .anim-out), statt es hart zu entfernen. */
export function Presence({ show, children, className, enter = "anim-rise" }: { show: boolean; children: ReactNode; className?: string; enter?: string }) {
  const [state, setState] = useState<"in" | "out" | "gone">(show ? "in" : "gone");
  if (show && state !== "in") setState("in");
  if (!show && state === "in") setState("out");
  if (state === "gone") return null;
  return (
    <div className={cx(className, state === "out" ? "anim-out" : enter)} inert={state === "out"}
      onAnimationEnd={(e) => { if (state === "out" && e.target === e.currentTarget) setState("gone"); }}>
      {children}
    </div>
  );
}

/**
 * Zahl, deren Ziffern vertikal rollen – aber nur, wenn sich der Wert ändert, während die
 * Seite offen ist (Live-Änderung). Beim ersten Zeichnen steht sie still.
 */
export function RollingNumber({ value, className }: { value: number | string; className?: string }) {
  const [state, setState] = useState<{ value: number | string; before: string; dir: "up" | "down" | null }>({ value, before: String(value), dir: null });
  if (state.value !== value) {
    const up = typeof value === "number" && typeof state.value === "number" ? value > state.value : true;
    setState({ value, before: String(state.value), dir: up ? "up" : "down" });
  }
  const text = String(value);
  const before = state.before.padStart(text.length, " ");
  return (
    <span className={cx("roll", className)}>
      {/* Für Screenreader eine Zahl, nicht einzelne Ziffern */}
      <span className="sr-only">{text}</span>
      {[...text].map((ch, i) => (
        <span aria-hidden key={`${i}-${ch}`} className={state.dir && before[i] !== ch ? (state.dir === "up" ? "roll-up" : "roll-down") : undefined}>{ch}</span>
      ))}
    </span>
  );
}

/**
 * Navigation mit einer Markierung, die zum aktiven Eintrag gleitet: ein absolut positioniertes
 * Element, Position und Grösse als CSS-Variablen. Gemessen wird der Eintrag mit aria-current
 * (bzw. darin das Element mit data-nav-target).
 */
export function NavRail({ children, className, marker, ...rest }: { children: ReactNode; className?: string; marker: string } & Omit<React.ComponentProps<"div">, "children" | "className">) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const measured = useRef(false);

  useLayoutEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const place = () => {
      const cur = rail.querySelector<HTMLElement>('[aria-current="page"]');
      const target = cur?.querySelector<HTMLElement>("[data-nav-target]") ?? cur;
      if (!target || rail.offsetParent === null) { rail.removeAttribute("data-ready"); measured.current = false; return; }
      const a = rail.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      rail.style.setProperty("--nav-x", `${b.left - a.left}px`);
      rail.style.setProperty("--nav-y", `${b.top - a.top}px`);
      rail.style.setProperty("--nav-w", `${b.width}px`);
      rail.style.setProperty("--nav-h", `${b.height}px`);
      // Erst ab der zweiten Messung gleiten: beim Laden steht die Marke sofort richtig
      if (measured.current) rail.setAttribute("data-moving", "");
      rail.setAttribute("data-ready", "");
      measured.current = true;
    };
    place();
    const ro = new ResizeObserver(() => { rail.removeAttribute("data-moving"); place(); });
    ro.observe(rail);
    return () => ro.disconnect();
  }, [path]);

  return (
    <div ref={ref} className={cx("nav-rail", className)} {...rest}>
      <span aria-hidden className={cx("nav-marker", marker)} />
      {children}
    </div>
  );
}

const CEREMONY_MS = 2600;

/**
 * Die Übergabe – der einzige feierliche Moment der App. Setzt für kurze Zeit ein Attribut auf
 * <html>, an das die Zeitachse, der Status-Chip und der Stempel ihre Animation binden,
 * und lässt das Telefon einmal kurz vibrieren (wie der Scanner). Kein Konfetti.
 */
export function celebrateHandover() {
  const root = document.documentElement;
  root.dataset.ceremony = "handover";
  try { navigator.vibrate?.(40); } catch {}
  window.dispatchEvent(new CustomEvent("lr:handover"));
  window.setTimeout(() => { delete root.dataset.ceremony; }, CEREMONY_MS);
}

/** Stempel auf dem Cover: erscheint mit der Übergabe und bleibt, solange die Seite offen ist. */
export function HandoverStamp({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const show = () => setOn(true);
    window.addEventListener("lr:handover", show);
    return () => window.removeEventListener("lr:handover", show);
  }, []);
  if (!on) return null;
  return <span className="stamp" role="status">{text}</span>;
}
