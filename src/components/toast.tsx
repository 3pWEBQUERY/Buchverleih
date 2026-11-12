"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Keine Bestätigungsdialoge für umkehrbare Aktionen (PRD 8.2): sofort ausführen
 * und «Rückgängig» anbieten. Für Wechsel, die sich in der Zustandsmaschine nicht
 * umkehren lassen, wird das Senden um wenige Sekunden verzögert.
 */
type Toast = { id: number; text: string; undo?: () => void | Promise<void>; tone?: "neutral" | "error" };
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) clearTimeout(tm);
    timers.current.delete(id);
  }, []);

  const show = useCallback<Ctx["show"]>((t, ms = 5000) => {
    const id = ++seq.current;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  const error = useCallback((text: string) => show({ text, tone: "error" }, 7000), [show]);

  const deferred = useCallback<Ctx["deferred"]>((text, commit, ms = 5000) => {
    const id = ++seq.current;
    let cancelled = false;
    setToasts((all) => [...all.slice(-2), { id, text, undo: () => { cancelled = true; } }]);
    timers.current.set(id, setTimeout(async () => {
      dismiss(id);
      if (!cancelled) {
        try { await commit(); } catch (e) { error((e as Error).message); }
      }
    }, ms));
  }, [dismiss, error]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  return (
    <ToastCtx.Provider value={{ show, error, deferred }}>
      {children}
      <div aria-live="polite" className="fixed z-50 inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
            className={`anim-sheet pointer-events-auto max-w-md w-full flex items-center justify-between gap-4 px-4 py-3 rounded-[10px] border text-[15px] ${t.tone === "error" ? "bg-paper border-late/50 text-late" : "bg-paper border-line-strong text-ink"}`}>
            <span>{t.text}</span>
            {t.undo && (
              <button className="font-semibold text-accent-hover underline underline-offset-4 flex-none min-h-9" onClick={async () => { await t.undo?.(); dismiss(t.id); }}>
                Rückgängig
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
