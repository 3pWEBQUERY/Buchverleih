"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LOCALES, localeName, type Locale } from "@/lib/i18n/locale";
import { useLocale } from "./locale-provider";
import { cx } from "./ui";

const LABEL: Record<Locale, string> = { de: "Sprache", fr: "Langue", it: "Lingua" };

async function save(l: Locale) {
  await fetch("/api/v1/locale", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: l }) });
}

/** Kurze Umschaltung DE · FR · IT (Seitenleiste, Fusszeile) */
export function LanguageSwitch({ tone = "paper", className }: { tone?: "paper" | "night"; className?: string }) {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Locale | null>(null);
  return (
    <div role="radiogroup" aria-label={LABEL[current]} className={cx("inline-flex items-center gap-0.5", pending && "opacity-60", className)}>
      {LOCALES.map((l) => {
        const on = l === current;
        return (
          <button key={l} type="button" role="radio" aria-checked={on} lang={l} title={localeName[l]} disabled={busy !== null}
            onClick={async () => {
              if (on) return;
              setBusy(l);
              await save(l).catch(() => {});
              start(() => router.refresh());
              setBusy(null);
            }}
            className={cx("h-7 min-w-8 px-1.5 rounded-[4px] text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors",
              tone === "night"
                ? on ? "bg-night-2 text-night-ink" : "text-night-muted hover:text-night-ink"
                : on ? "bg-paper text-ink outline outline-1 outline-line-strong" : "text-muted hover:text-ink")}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** Ausführliche Wahl in den Einstellungen */
export function LanguageChoice() {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label={LABEL[current]} className={cx("grid grid-cols-3 gap-2 max-w-[460px]", pending && "opacity-60")}>
      {LOCALES.map((l) => {
        const on = l === current;
        return (
          <button key={l} type="button" role="radio" aria-checked={on} lang={l}
            onClick={async () => { if (!on) { await save(l).catch(() => {}); start(() => router.refresh()); } }}
            className={cx("text-left rounded-[10px] border px-3.5 py-3 transition-colors", on ? "border-accent bg-accent-soft/35" : "border-line hover:border-ink-2")}>
            <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{l}</span>
            <span className="block text-[15px] font-medium mt-1">{localeName[l]}</span>
          </button>
        );
      })}
    </div>
  );
}
