"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { CLIENT_ERRORS } from "@/lib/i18n/messages/client-errors";

/**
 * Für Schritte, die sich nicht umkehren lassen (PRD 8.2): kein Dialog, sondern
 * 5 Sekunden Aufschub mit «Rückgängig». Danach senden und die Seite auffrischen.
 */
export function useLater() {
  const toast = useToast();
  const router = useRouter();
  const generic = CLIENT_ERRORS[useLocale()].generic;
  return (text: string, commit: () => Promise<unknown>, onUndo: () => void) => {
    const t = setTimeout(async () => {
      try {
        await commit();
        router.refresh();
      } catch (e) {
        onUndo();
        toast.error(e instanceof Error ? e.message : generic);
      }
    }, 5000);
    toast.show({ text, undo: () => { clearTimeout(t); onUndo(); } }, 5000);
  };
}
