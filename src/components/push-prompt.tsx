"use client";
import { useEffect, useState } from "react";
import { enablePush, pushSupported, swReady } from "@/lib/push-client";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { IconBell, IconClose } from "@/components/icons";
import { SETTINGS_UI } from "@/lib/i18n/messages/settings-sections";
import type { Locale } from "@/lib/i18n/locale";

const KEY = "lr_push_prompt";
const TEXT: Record<Locale, { title: string; text: string; yes: string; later: string; done: string }> = {
  de: { title: "Antworten sofort aufs Handy?", text: "Mit Push erfährst du gleich, wenn jemand antwortet oder eine Frist naht – auch wenn Leihregal zu ist. Pro Art einzeln abschaltbar.", yes: "Push einschalten", later: "Später", done: "Push ist eingeschaltet." },
  fr: { title: "Les réponses directement sur ton téléphone ?", text: "Avec le push, tu sais tout de suite quand quelqu’un répond ou qu’un délai approche – même quand Leihregal est fermé. Désactivable par type.", yes: "Activer le push", later: "Plus tard", done: "Le push est activé." },
  it: { title: "Risposte subito sul telefono?", text: "Con il push sai subito quando qualcuno risponde o una scadenza si avvicina – anche con Leihregal chiuso. Disattivabile per tipo.", yes: "Attiva il push", later: "Più tardi", done: "Il push è attivo." },
  en: { title: "Get replies on your phone right away?", text: "With push you know straight away when someone replies or a deadline is close – even when Leihregal is closed. You can turn off each kind.", yes: "Turn on push", later: "Later", done: "Push is on." },
};

/**
 * Zustimmung zu Push im passenden Moment (PRD 7.6): erst in einem Vorgang, also nach der ersten Anfrage,
 * nie beim ersten Besuch. Erscheint nur, solange der Browser noch nicht gefragt hat und niemand «Später» wählte.
 */
export function PushPrompt() {
  const l = useLocale();
  const t = TEXT[l];
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!pushSupported() || Notification.permission !== "default") return;
      try { if (localStorage.getItem(KEY)) return; } catch {}
      const reg = await swReady();
      if (!reg || (await reg.pushManager.getSubscription())) return;
      if (alive) setShow(true);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  const later = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  if (!show) return null;
  return (
    <aside className="mt-4 rounded-md border border-accent/30 bg-accent-soft/30 p-4 md:p-5 flex gap-4 items-start anim-rise" aria-labelledby="push-prompt-t">
      <span aria-hidden className="h-9 w-9 rounded-md bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconBell width={18} height={18} /></span>
      <div className="min-w-0 flex-1">
        <p id="push-prompt-t" className="font-medium">{t.title}</p>
        <p className="text-body-sm text-ink-2 mt-0.5">{t.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await enablePush(SETTINGS_UI[l].push.notReady);
              if (r && "devices" in r) toast.show({ text: t.done });
              later();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}>{t.yes}</Button>
          <Button size="sm" variant="quiet" onClick={later}>{t.later}</Button>
        </div>
      </div>
      <button type="button" onClick={later} aria-label={t.later} className="h-9 w-9 -m-1.5 grid place-items-center rounded-sm text-muted hover:text-ink"><IconClose width={16} height={16} /></button>
    </aside>
  );
}
