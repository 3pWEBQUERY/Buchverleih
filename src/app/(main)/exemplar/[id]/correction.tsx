"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";

/** Fehler in Titeldaten melden; die Moderation prüft die Korrektur (PRD 7.2). */
export function CorrectionForm({ editionId, loggedIn }: { editionId: string; loggedIn: boolean }) {
  const [field, setField] = useState("title");
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const toast = useToast();
  if (sent) return <p id="korrektur" className="text-sm text-muted">Danke. Die Moderation prüft deine Korrektur.</p>;
  return (
    <details id="korrektur" className="group text-sm text-muted">
      <summary className="cursor-pointer list-none inline-flex gap-1">Etwas stimmt an den Titeldaten nicht? <span className="underline underline-offset-4 group-hover:text-ink">Fehler melden</span></summary>
      {loggedIn ? (
        <form className="mt-4 panel p-5 grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end text-ink"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await api("/catalog/corrections", { body: { editionId, field, suggestion: value } }); setSent(true); }
            catch (err) { toast.error((err as Error).message); }
          }}>
          <Select value={field} onChange={(e) => setField(e.target.value)} aria-label="Feld">
            <option value="title">Titel</option>
            <option value="authors">Autorinnen und Autoren</option>
            <option value="publisher">Verlag</option>
            <option value="year">Jahr</option>
            <option value="language">Sprache</option>
            <option value="genre">Genre</option>
          </Select>
          <Input required maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Richtiger Wert" aria-label="Richtiger Wert" />
          <Button type="submit" variant="secondary" disabled={!value.trim()}>Senden</Button>
        </form>
      ) : (
        <p className="mt-3"><a href="/anmelden" className="underline underline-offset-4">Anmelden</a>, um eine Korrektur zu melden.</p>
      )}
    </details>
  );
}
