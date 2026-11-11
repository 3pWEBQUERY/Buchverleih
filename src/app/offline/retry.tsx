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
  return <Button variant="primary" onClick={() => window.location.reload()}>Erneut versuchen</Button>;
}
