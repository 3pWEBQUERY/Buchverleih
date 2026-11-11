"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="quiet" className="text-sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api("/auth/logout", { method: "POST" }); } finally { window.location.assign("/"); }
    }}>
      Abmelden
    </Button>
  );
}
