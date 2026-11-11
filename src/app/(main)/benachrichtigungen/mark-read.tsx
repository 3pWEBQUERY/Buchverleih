"use client";
import { useEffect } from "react";
import { api } from "@/lib/client";

/** Beim Öffnen der Seite gelten alle Benachrichtigungen als gelesen. Die Markierung bleibt bis zum nächsten Besuch sichtbar. */
export function MarkAllRead({ active }: { active: boolean }) {
  useEffect(() => {
    if (active) api("/notifications", { body: { all: true } }).catch(() => {});
  }, [active]);
  return null;
}
