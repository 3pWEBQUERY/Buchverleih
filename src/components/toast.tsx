"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "./locale-provider";
import { COMMON } from "@/lib/i18n/messages/common";

/**
 * Keine Bestätigungsdialoge für umkehrbare Aktionen (PRD 8.2): sofort ausführen
 * und «Rückgängig» anbieten. Für Wechsel, die sich in der Zustandsmaschine nicht
 * umkehren lassen, wird das Senden um wenige Sekunden verzögert.
 */
type Toast = { id: number; text: string; undo?: () => void | Promise<void>; tone?: "neutral" | "error"; ms?: number; leaving?: boolean };
type Ctx = {
  show: (t: Omit<Toast, "id">, ms?: number) => void;
  error: (text: string) => void;
  /** Führt `commit` nach `ms` aus, ausser die Person tippt «Rückgängig». */
  deferred: (text: string, commit: () => Promise<void>, ms?: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("ToastProvider fehlt");
  return c;
}

const MAX = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const undoLabel = COMMON[useLocale()].undo;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const list = useRef<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  /** Verzögerte Aktionen, die beim Verdrängen sofort ausgeführt werden */
  const flushers = useRef(new Map<number, () => void>());

  const set = useCallback((next: Toast[]) => {
    list.current = next;
    setToasts(next);
  }, []);

  const remove = useCallback((id: number) => set(list.current.filter((x) => x.id !== id)), [set]);

  /** Meldung verabschieden: erst die Austritts-Animation, dann aus der Liste (ToastItem ruft remove) */
  const dismiss = useCallback((id: number) => {
    set(list.current.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    const tm = timers.current.get(id);
    if (tm) clearTimeout(tm);
    timers.current.delete(id);
    flushers.current.delete(id);
  }, [set]);

  /** Neue Meldung; ältere über dem Maximum verschwinden. Verzögerte Aktionen laufen dann sofort, statt unsichtbar weiterzulaufen. */
  const push = useCallback((t: Toast) => {
    const next = [...list.current, t];
    const dropped = next.slice(0, Math.max(0, next.length - MAX));
    set(next.slice(-MAX));
    for (const d of dropped) {
      const tm = timers.current.get(d.id);
      if (tm) clearTimeout(tm);
      timers.current.delete(d.id);
      const flush = flushers.current.get(d.id);
      flushers.current.delete(d.id);
      flush?.();
    }
  }, [set]);

  const show = useCallback<Ctx["show"]>((t, ms = 5000) => {
    const id = ++seq.current;
    push({ ...t, id, ms });
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss, push]);

  const error = useCallback((text: string) => show({ text, tone: "error" }, 7000), [show]);

  const deferred = useCallback<Ctx["deferred"]>((text, commit, ms = 5000) => {
    const id = ++seq.current;
    let state: "pending" | "cancelled" | "done" = "pending";
    const run = async () => {
      if (state !== "pending") return;
      state = "done";
      try { await commit(); } catch (e) { error((e as Error).message); }
    };
    flushers.current.set(id, () => { void run(); });
    push({ id, text, ms, undo: () => { if (state === "pending") state = "cancelled"; } });
    timers.current.set(id, setTimeout(() => {
      dismiss(id);
      void run();
    }, ms));
  }, [dismiss, error, push]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearTimeout(x));
  }, []);

  return (
    <ToastCtx.Provider value={{ show, error, deferred }}>
      {children}
      <ToastStack toasts={toasts} undoLabel={undoLabel} dismiss={dismiss} remove={remove} />
    </ToastCtx.Provider>
  );
}

/**
 * Der Stapel. Fällt eine Meldung weg oder kommt eine dazu, rücken die übrigen nach – per transform
 * (FLIP: Lage vorher/nachher messen, Differenz als Verschiebung abspielen), nie über Layout.
 */
function ToastStack({ toasts, undoLabel, dismiss, remove }: { toasts: Toast[]; undoLabel: string; dismiss: (id: number) => void; remove: (id: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const child of [...el.children] as HTMLElement[]) {
      const id = child.dataset.toast!;
      const top = child.getBoundingClientRect().top;
      next.set(id, top);
      const before = tops.current.get(id);
      if (!reduce && before !== undefined && Math.abs(before - top) > 1 && !child.classList.contains("anim-out")) {
        child.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(0.25, 1, 0.5, 1)" });
      }
    }
    tops.current = next;
  }, [toasts]);
  return (
    <div ref={box} aria-live="polite" className="fixed z-50 inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 in-data-sheet:bottom-[calc(196px+env(safe-area-inset-bottom))] md:in-data-sheet:bottom-28 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => <ToastItem key={t.id} t={t} undoLabel={undoLabel} onDismiss={() => dismiss(t.id)} onGone={() => remove(t.id)} />)}
    </div>
  );
}

function ToastItem({ t, undoLabel, onDismiss, onGone }: { t: Toast; undoLabel: string; onDismiss: () => void; onGone: () => void }) {
  const [used, setUsed] = useState(false);
  // Ohne Animation (z. B. Tab im Hintergrund) trotzdem aufräumen
  useEffect(() => {
    if (!t.leaving) return;
    const tm = setTimeout(onGone, 400);
    return () => clearTimeout(tm);
  }, [t.leaving, onGone]);
  return (
    <div data-toast={t.id} role={t.tone === "error" ? "alert" : "status"}
      onAnimationEnd={(e) => { if (t.leaving && e.target === e.currentTarget) onGone(); }}
      className={`${t.leaving ? "anim-out" : "anim-sheet"} relative overflow-hidden pointer-events-auto max-w-md w-full flex items-center justify-between gap-4 px-4 py-3 rounded-md border text-body ${t.tone === "error" ? "bg-paper border-late/50 text-late" : "bg-paper border-field text-ink"}`}>
      <span>{t.text}</span>
      {t.undo && (
        <button className="font-semibold text-accent-hover underline underline-offset-4 flex-none min-h-9 disabled:opacity-50" disabled={used || t.leaving}
          onClick={async () => {
            if (used) return;
            setUsed(true);
            await t.undo?.();
            onDismiss();
          }}>
          {undoLabel}
        </button>
      )}
      {/* Rückgängig-Frist: der Strich läuft in genau der Zeit ab, die zum Zurücknehmen bleibt */}
      {t.undo && t.ms && !t.leaving && <span aria-hidden className="toast-timer" style={{ animationDuration: `${t.ms}ms` }} />}
    </div>
  );
}
