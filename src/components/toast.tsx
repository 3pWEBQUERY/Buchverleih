"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "./locale-provider";
import { COMMON } from "@/lib/i18n/messages/common";

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

  const dismiss = useCallback((id: number) => {
    set(list.current.filter((x) => x.id !== id));
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
    push({ ...t, id });
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
    push({ id, text, undo: () => { if (state === "pending") state = "cancelled"; } });
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
      <div aria-live="polite" className="fixed z-50 inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 in-data-sheet:bottom-[calc(196px+env(safe-area-inset-bottom))] md:in-data-sheet:bottom-28 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => <ToastItem key={t.id} t={t} undoLabel={undoLabel} onDone={() => dismiss(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t, undoLabel, onDone }: { t: Toast; undoLabel: string; onDone: () => void }) {
  const [used, setUsed] = useState(false);
  return (
    <div role={t.tone === "error" ? "alert" : "status"}
      className={`anim-sheet pointer-events-auto max-w-md w-full flex items-center justify-between gap-4 px-4 py-3 rounded-[10px] border text-[15px] ${t.tone === "error" ? "bg-paper border-late/50 text-late" : "bg-paper border-line-strong text-ink"}`}>
      <span>{t.text}</span>
      {t.undo && (
        <button className="font-semibold text-accent-hover underline underline-offset-4 flex-none min-h-9 disabled:opacity-50" disabled={used}
          onClick={async () => {
            if (used) return;
            setUsed(true);
            await t.undo?.();
            onDone();
          }}>
          {undoLabel}
        </button>
      )}
    </div>
  );
}
