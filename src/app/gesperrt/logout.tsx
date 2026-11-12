"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

export function LogoutButton({ label = "Abmelden" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api("/auth/logout", { method: "POST" }); } finally { window.location.assign("/"); }
    }}>
      {label}
    </Button>
  );
}
