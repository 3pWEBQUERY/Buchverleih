"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";
import { IconCheck } from "./icons";

/**
 * Auswahlfeld mit eigener Oberfläche statt des Menüs von Browser oder Betriebssystem.
 *
 * Bedienung wie ein natives Select (ARIA «select-only combobox»):
 *  – Enter, Leertaste, Pfeil runter/hoch öffnen; Pfeile, Pos1, Ende wandern; Enter/Leertaste wählen
 *  – Tippen springt zum ersten Eintrag mit diesem Anfang; Esc und Tab schliessen
 *  – geschlossen ändern Pfeiltasten den Wert direkt (wie unter Windows), Alt+Pfeil öffnet
 * Die Liste liegt als Popover in der obersten Ebene, öffnet nach unten oder – ohne Platz – nach oben.
 */
export type SelectOption<T extends string> = { value: T; label: ReactNode; text?: string; hint?: ReactNode; disabled?: boolean };

const fieldCls =
  "w-full h-12 bg-paper border border-field rounded-sm pl-4 pr-10 text-body-lg text-left hover:border-ink-2 focus:outline-none focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/10 transition-[border-color,box-shadow]";
const pillCls =
  "h-11 md:h-9 pl-3.5 pr-8 rounded-sm border text-body-sm font-medium whitespace-nowrap focus:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 transition-colors";

export function Select<T extends string>({
  value, onChange, options, placeholder, label, disabled, className, variant = "field", id, active,
  "aria-label": ariaLabel, "aria-describedby": describedBy,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  /** Text, solange kein Eintrag gewählt ist (value passt zu keiner Option) */
  placeholder?: ReactNode;
  /** Unsichtbare Beschriftung, falls das Feld nicht in einem <label>/Field steht */
  label?: string;
  disabled?: boolean;
  className?: string;
  /** «field»: Eingabefeld der Formulare · «pill»: Filter-Chip der Suche */
  variant?: "field" | "pill";
  id?: string;
  /** Nur «pill»: als gesetzter Filter hervorheben */
  active?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const typed = useRef({ text: "", at: 0 });

  const current = options.findIndex((o) => o.value === value);
  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const step = useCallback((from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  }, [options]);
  const first = () => step(-1, 1);
  const last = () => step(options.length, -1);

  const show = useCallback((at?: number) => {
    if (disabled) return;
    setHi(at ?? (current >= 0 ? current : step(-1, 1)));
    setOpen(true);
  }, [disabled, current, step]);
  const hide = useCallback((focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  }, []);
  const choose = (i: number) => {
    if (!enabled(i)) return;
    if (options[i].value !== value) onChange(options[i].value);
    hide();
  };

  // Popover ein- und ausblenden, Lage am Auslöser ausrichten (unten, sonst oben)
  useLayoutEffect(() => {
    const el = list.current;
    const b = btn.current;
    if (!el || !b) return;
    if (!open) { if (el.matches(":popover-open")) el.hidePopover(); return; }
    if (!el.matches(":popover-open")) el.showPopover();
    const place = () => {
      const r = b.getBoundingClientRect();
      const vh = window.innerHeight;
      const below = vh - r.bottom - 8;
      const above = r.top - 8;
      const want = Math.min(el.scrollHeight, 320);
      const up = below < Math.min(want, 200) && above > below;
      el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8))}px`;
      el.style.minWidth = `${r.width}px`;
      el.style.maxHeight = `${Math.max(120, Math.min(320, up ? above : below))}px`;
      el.style.top = up ? "" : `${r.bottom + 4}px`;
      el.style.bottom = up ? `${vh - r.top + 4}px` : "";
      el.dataset.side = up ? "top" : "bottom";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  // Hervorgehobenen Eintrag sichtbar halten
  useEffect(() => {
    if (!open || hi < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  // Klick ausserhalb schliesst (Popover «manual», damit der Auslöser selbst nicht doppelt umschaltet)
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !btn.current?.contains(t)) hide(false);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open, hide]);

  /** Tippen springt zum ersten passenden Eintrag (Text wird über 600 ms gesammelt) */
  const typeahead = (ch: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 600 ? ch : t.text + ch;
    t.at = now;
    const start = open ? hi : current;
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const q = norm(t.text);
    const order = [...options.keys()].map((k) => (k + Math.max(0, start) + (t.text.length === 1 ? 1 : 0)) % options.length);
    const hit = order.find((i) => enabled(i) && norm(options[i].text ?? String(options[i].label)).startsWith(q));
    if (hit === undefined) return;
    if (open) setHi(hit);
    else onChange(options[hit].value);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if ((k === "ArrowDown" || k === "ArrowUp") && e.altKey) { e.preventDefault(); show(); return; }
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); show(); return; }
      if (k === "Home" || k === "End") { e.preventDefault(); show(k === "Home" ? first() : last()); return; }
    } else {
      if (k === "ArrowDown") { e.preventDefault(); setHi((i) => step(i, 1)); return; }
      if (k === "ArrowUp") { e.preventDefault(); if (e.altKey) choose(hi); else setHi((i) => step(i, -1)); return; }
      if (k === "Home") { e.preventDefault(); setHi(first()); return; }
      if (k === "End") { e.preventDefault(); setHi(last()); return; }
      if (k === "PageDown") { e.preventDefault(); setHi((i) => { let j = i; for (let n = 0; n < 8; n++) j = step(j, 1); return j; }); return; }
      if (k === "PageUp") { e.preventDefault(); setHi((i) => { let j = i; for (let n = 0; n < 8; n++) j = step(j, -1); return j; }); return; }
      if (k === "Enter" || (k === " " && Date.now() - typed.current.at > 600)) { e.preventDefault(); choose(hi); return; }
      if (k === "Escape") { e.preventDefault(); hide(); return; }
      if (k === "Tab") { choose(hi); setOpen(false); return; }
    }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && k !== " ") typeahead(k);
  };

  const sel = current >= 0 ? options[current] : null;
  const pill = variant === "pill";
  const on = pill && Boolean(active ?? (sel && value !== ""));

  return (
    <span className={cx("relative inline-flex", pill ? "flex-none" : "w-full", className)}>
      {label && <span className="sr-only" id={`${uid}-label`}>{label}</span>}
      <button ref={btn} id={id} type="button" role="combobox" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && hi >= 0 ? `${uid}-o${hi}` : undefined}
        aria-label={ariaLabel} aria-labelledby={label && !ariaLabel ? `${uid}-label ${uid}-value` : undefined} aria-describedby={describedBy}
        onClick={() => (open ? hide() : show())} onKeyDown={onKey}
        className={cx(pill ? pillCls : fieldCls, pill && (on ? "border-accent/50 bg-accent-soft/40 text-accent-hover" : "border-line bg-paper text-ink-2 hover:border-ink-2 hover:text-ink"),
          "relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed", open && !pill && "border-ink")}>
        <span id={`${uid}-value`} className={cx("block truncate", !sel && !pill && "text-muted")}>{sel ? sel.label : placeholder}</span>
        <svg aria-hidden viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6"
          className={cx("absolute top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-fast", pill ? "right-3 w-2.5" : "right-4 w-3", open && "rotate-180",
            pill ? (on ? "text-accent-hover" : "text-muted") : "text-ink-2")}>
          <path d="M1 1.5l5 5 5-5" />
        </svg>
      </button>
      <ul ref={list} id={listId} role="listbox" popover="manual" tabIndex={-1}
        aria-labelledby={label ? `${uid}-label` : undefined} aria-label={!label ? ariaLabel : undefined}
        className="select-list fixed inset-auto m-0 p-1 overflow-y-auto overscroll-contain rounded-md border border-line bg-paper text-ink text-body">
        {options.map((o, i) => {
          const isSel = i === current;
          const isHi = i === hi;
          return (
            <li key={o.value} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
              onPointerMove={() => !o.disabled && hi !== i && setHi(i)}
              onClick={() => choose(i)}
              className={cx("flex items-start gap-2.5 min-h-11 md:min-h-10 px-3 py-2 rounded-sm select-none",
                o.disabled ? "text-muted cursor-not-allowed" : "cursor-pointer",
                isHi && !o.disabled && "bg-paper-2", isSel && "font-medium")}>
              <span aria-hidden className={cx("flex-none mt-[3px] w-4", isSel ? "text-accent-hover" : "invisible")}><IconCheck width={16} height={16} /></span>
              <span className="min-w-0">
                <span className="block">{o.label}</span>
                {o.hint && <span className="block text-meta text-muted font-normal mt-0.5">{o.hint}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </span>
  );
}
