"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export function RetryButton() {
  // Kommt das Netz zurück, gleich neu laden
  useEffect(() => {
    const on = () => window.location.reload();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="primary" size="lg" onClick={() => window.location.reload()}>Erneut versuchen</Button>
      <span className="inline-flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 rounded-full bg-late live-dot" /> Wartet auf das Netz</span>
    </div>
  );
}
