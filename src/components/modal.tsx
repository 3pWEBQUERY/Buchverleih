"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Modales Vollbild als natives <dialog>: showModal() bringt Fokusfalle, Esc, einen inerten
 * Hintergrund und die oberste Ebene (Top-Layer) mit – kein eigener Fokus-Hook, kein Portal, kein z-index.
 * Beim Schliessen geht der Fokus zurück auf das Element, das den Dialog geöffnet hat.
 */
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

  return (
    <dialog ref={ref} aria-label={label}
      // Esc: nicht selbst schliessen, sondern den Zustand der aufrufenden Komponente ändern
      onCancel={(e) => { e.preventDefault(); close.current(); }}
      className={cx("modal fixed inset-0 m-0 p-0 w-screen h-dvh max-w-none max-h-none border-0 overflow-y-auto backdrop:bg-transparent", className)}
      style={style}>
      {children}
    </dialog>
  );
}
