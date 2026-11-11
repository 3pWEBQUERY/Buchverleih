"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button, Field, Input, PageTitle, Segmented, Switch, Textarea } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";

export type CircleValues = {
  name: string;
  description: string;
  loanDays: 14 | 28 | 42 | 56;
  autoAccept: boolean;
  fixedSpot: string;
  joinMode: "link" | "approval";
};

const EMPTY: CircleValues = { name: "", description: "", loanDays: 28, autoAccept: false, fixedSpot: "", joinMode: "link" };

/** Die Felder eines Kreises – beim Gründen und in den Einstellungen dieselben. */
export function CircleFields({ v, set, nameError }: { v: CircleValues; set: (p: Partial<CircleValues>) => void; nameError?: string | null }) {
  return (
    <div className="space-y-6">
      <Field label="Name" error={nameError} hint="Zum Beispiel «Haus Kirchweg 4» oder «Lesekreis Bülach».">
        <Input value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      </Field>
      <Field label={<>Beschreibung <span className="text-muted font-normal">(freiwillig)</span></>} hint={`Wer gehört dazu, worum geht es. ${280 - v.description.length} Zeichen frei.`}>
        <Textarea rows={3} maxLength={280} value={v.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Leihfrist im Kreis" hint="Gilt für alle Bücher, die Mitglieder im Kreis verleihen.">
        <Segmented name="Leihfrist im Kreis" value={v.loanDays} onChange={(d) => set({ loanDays: d })}
          options={([14, 28, 42, 56] as const).map((d) => ({ value: d, label: `${d} Tage` }))} />
      </Field>
      <div className="border-y border-line">
        <Switch checked={v.autoAccept} onChange={(b) => set({ autoAccept: b })} label="Anfragen automatisch annehmen"
          hint="Anfragen von Mitgliedern gelten sofort als angenommen, wenn der Kalender frei ist." />
      </div>
      <Field label={<>Fester Übergabeort <span className="text-muted font-normal">(freiwillig)</span></>} hint="Zum Beispiel «Regal im Treppenhaus». Sonst vereinbart ihr den Ort pro Leihe.">
        <Input value={v.fixedSpot} maxLength={80} onChange={(e) => set({ fixedSpot: e.target.value })} autoComplete="off" />
      </Field>
      <Field label="Beitritt" hint={v.joinMode === "link" ? "Wer den Einladungslink hat, ist sofort Mitglied." : "Wer den Link öffnet, stellt eine Anfrage. Admins geben frei."}>
        <Segmented name="Beitritt" value={v.joinMode} onChange={(m) => set({ joinMode: m })}
          options={[{ value: "link", label: "Per Link" }, { value: "approval", label: "Mit Freigabe" }]} />
      </Field>
    </div>
  );
}

export function CircleForm() {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<CircleValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (v.name.trim().length < 2) {
      setNameError("Gib dem Kreis einen Namen mit mindestens zwei Zeichen.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/circles", {
        body: {
          name: v.name.trim(),
          description: v.description.trim() || null,
          loanDays: v.loanDays,
          autoAccept: v.autoAccept,
          fixedSpot: v.fixedSpot.trim() || null,
          joinMode: v.joinMode,
        },
      });
      toast.show({ text: `«${v.name.trim()}» ist gegründet. Lade jetzt Mitglieder ein.` });
      router.push(`/kreise/${r.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6 md:mb-8">
        <IconArrowLeft width={16} height={16} /> Kreise
      </Link>
      <PageTitle sub="Du wirst Admin. Danach erhältst du einen Einladungslink. Alles lässt sich später ändern.">Kreis gründen</PageTitle>
      <form onSubmit={submit} noValidate>
        <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
        <div className="mt-8">
          <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Wird gegründet …" : "Kreis gründen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
