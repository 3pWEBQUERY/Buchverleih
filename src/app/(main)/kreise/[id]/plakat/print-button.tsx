"use client";
import { Button } from "@/components/ui";

/** Öffnet den Druckdialog; erscheint selbst nicht auf dem Plakat */
export function PrintButton({ label }: { label: string }) {
  return <Button type="button" variant="primary" onClick={() => window.print()} className="print:hidden">{label}</Button>;
}
