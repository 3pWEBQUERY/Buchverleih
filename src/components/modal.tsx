"use client";
import { createContext, useCallback, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Modales Vollbild als natives <dialog>: showModal() bringt Fokusfalle, Esc, einen inerten
 * Hintergrund und die oberste Ebene (Top-Layer) mit – kein eigener Fokus-Hook, kein Portal, kein z-index.
 * Beim Schliessen geht der Fokus zurück auf das Element, das den Dialog geöffnet hat.
 */
const CloseCtx = createContext<() => void>(() => {});
/** Schliesst den umgebenden Dialog mit Austritts-Animation (für den Schliessen-Knopf im Dialog) */
export const useModalClose = () => useContext(CloseCtx);

export function Modal({ label, onClose, className, style, children }: {
  label: string; onClose: () => void; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const before = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (d.open) d.close();
      // Der Dialog wird meist durch Aushängen geschlossen: Fokus von Hand zurückgeben
      if (before?.isConnected) before.focus();
    };
  }, []);

  /** Erst ausblenden (CSS-Übergang auf dialog.modal), dann den Zustand der aufrufenden Komponente ändern */
  const requestClose = useCallback(() => {
    const d = ref.current;
    if (!d?.open) { close.current(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; close.current(); } };
    d.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, 220);
    d.close();
  }, []);

  return (
    <dialog ref={ref} aria-label={label}
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      className={cx("modal fixed inset-0 m-0 p-0 w-screen h-dvh max-w-none max-h-none border-0 overflow-y-auto backdrop:bg-transparent", className)}
      style={style}>
      <CloseCtx.Provider value={requestClose}>{children}</CloseCtx.Provider>
    </dialog>
  );
}

/** Schliessen-Knopf innerhalb eines Modal: löst den Austritt aus */
export function ModalClose({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  const close = useModalClose();
  return <button type="button" onClick={close} className={className} aria-label={label}>{children}</button>;
}
