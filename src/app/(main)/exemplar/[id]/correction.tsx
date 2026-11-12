"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { EXEMPLAR } from "@/lib/i18n/messages/exemplar";

/** Fehler in Titeldaten melden; die Moderation prüft die Korrektur (PRD 7.2). */
export function CorrectionForm({ editionId, loggedIn }: { editionId: string; loggedIn: boolean }) {
  const [field, setField] = useState("title");
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const toast = useToast();
  const t = EXEMPLAR[useLocale()].corr;
  if (sent) return <p id="korrektur" className="text-sm text-muted">{t.thanks}</p>;
  return (
    <details id="korrektur" className="group text-sm text-muted">
      <summary className="cursor-pointer list-none inline-flex gap-1">{t.ask} <span className="underline underline-offset-4 group-hover:text-ink">{t.report}</span></summary>
      {loggedIn ? (
        <form className="mt-4 panel p-5 grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end text-ink"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await api("/catalog/corrections", { body: { editionId, field, suggestion: value } }); setSent(true); }
            catch (err) { toast.error((err as Error).message); }
          }}>
          <Select value={field} onChange={(e) => setField(e.target.value)} aria-label={t.field}>
            {(["title", "authors", "publisher", "year", "language", "genre"] as const).map((f) => <option key={f} value={f}>{t.fields[f]}</option>)}
          </Select>
          <Input required maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t.value} aria-label={t.value} />
          <Button type="submit" variant="secondary" disabled={!value.trim()}>{t.send}</Button>
        </form>
      ) : (
        <p className="mt-3"><a href="/anmelden" className="underline underline-offset-4">{t.login}</a>{t.loginText}</p>
      )}
    </details>
  );
}
