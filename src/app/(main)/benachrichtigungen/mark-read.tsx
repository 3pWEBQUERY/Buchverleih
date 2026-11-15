"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

/** Beim Öffnen der Seite gelten alle Benachrichtigungen als gelesen. Die Markierung bleibt bis zum nächsten Besuch sichtbar. */
export function MarkAllRead({ active }: { active: boolean }) {
  // Nur einmal pro Besuch – sonst hebt das Neuladen nach «als ungelesen markieren» die Markierung gleich wieder auf
  const done = useRef(false);
  useEffect(() => {
    if (active && !done.current) {
      done.current = true;
      api("/notifications", { body: { all: true } }).catch(() => {});
    }
  }, [active]);
  return null;
}

/** Einzelne Benachrichtigung wieder als ungelesen markieren (zählt wieder im Glocken-Symbol) */
export function MarkUnread({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="text-meta text-muted hover:text-ink underline-offset-4 hover:underline min-h-9 px-1 -mx-1"
      onClick={async () => {
        setBusy(true);
        try { await api("/notifications", { body: { ids: [id], unread: true } }); router.refresh(); } finally { setBusy(false); }
      }}>
      {label}
    </button>
  );
}
