"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";

/** Kreisbibliothek: eine andere Admin-Person übernimmt die Betreuung (z. B. während Ferien) */
export function LibraryTakeover({ circleId, copyId }: { circleId: string; copyId: string }) {
  const t = CIRCLES[useLocale()].detail.library;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await api(`/circles/${circleId}/library`, { body: { copyId } });
        toast.show({ text: t.taken });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    }}>{t.take}</Button>
  );
}
