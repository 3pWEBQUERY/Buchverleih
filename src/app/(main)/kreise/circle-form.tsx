"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button, Field, Input, Switch, Textarea } from "@/components/ui";
import { OptionCard } from "@/components/form-controls";
import { StepSection } from "@/components/step-section";
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
    <div className="space-y-7">
      <Field label="Name" error={nameError} hint="Zum Beispiel «Haus Kirchweg 4» oder «Lesekreis Bülach».">
        <Input value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      </Field>
      <Field label={<>Beschreibung <span className="text-muted font-normal">(freiwillig)</span></>} hint={`Wer gehört dazu, worum geht es. ${280 - v.description.length} Zeichen frei.`}>
        <Textarea rows={3} maxLength={280} value={v.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div>
        <p className="font-medium text-[15px]">Leihfrist im Kreis</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">Gilt für alle Bücher, die Mitglieder im Kreis verleihen.</p>
        <div role="radiogroup" aria-label="Leihfrist im Kreis" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([14, 28, 42, 56] as const).map((d) => (
            <OptionCard key={d} compact on={v.loanDays === d} onClick={() => set({ loanDays: d })} title={`${d} Tage`} desc={`${d / 7} Wochen`} />
          ))}
        </div>
      </div>
      <div className="rounded-[10px] border border-line px-4">
        <Switch checked={v.autoAccept} onChange={(b) => set({ autoAccept: b })} label={<span className="font-medium text-[15px]">Anfragen automatisch annehmen</span>}
          hint="Anfragen von Mitgliedern gelten sofort als angenommen, wenn der Kalender frei ist." />
      </div>
      <Field label={<>Fester Übergabeort <span className="text-muted font-normal">(freiwillig)</span></>} hint="Zum Beispiel «Regal im Treppenhaus». Sonst vereinbart ihr den Ort pro Leihe.">
        <Input value={v.fixedSpot} maxLength={80} onChange={(e) => set({ fixedSpot: e.target.value })} autoComplete="off" />
      </Field>
      <div>
        <p className="font-medium text-[15px]">Beitritt</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">Wie neue Mitglieder in den Kreis kommen.</p>
        <div role="radiogroup" aria-label="Beitritt" className="grid sm:grid-cols-2 gap-2">
          <OptionCard on={v.joinMode === "link"} onClick={() => set({ joinMode: "link" })} title="Per Link" desc="Wer den Einladungslink hat, ist sofort Mitglied." />
          <OptionCard on={v.joinMode === "approval"} onClick={() => set({ joinMode: "approval" })} title="Mit Freigabe" desc="Wer den Link öffnet, stellt eine Anfrage. Admins geben frei." />
        </div>
      </div>
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
    <div className="max-w-3xl">
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Kreise
      </Link>
      <header className="anim-rise">
        <p className="eyebrow">Kreise</p>
        <h1 className="display text-[32px] md:text-[44px] mt-2">Kreis gründen. <em>Du wirst Admin.</em></h1>
        <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-xl">Danach erhältst du einen Einladungslink. Alles lässt sich später ändern.</p>
      </header>
      <form onSubmit={submit} noValidate className="mt-10">
        <StepSection n={1} first title="Kreis einrichten" desc="Name, Leihfrist, Übergabe und Beitritt.">
          <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
          <div className="mt-8 pt-6 border-t border-line">
            <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Wird gegründet …" : "Kreis gründen"}
            </Button>
          </div>
        </StepSection>
      </form>
    </div>
  );
}
