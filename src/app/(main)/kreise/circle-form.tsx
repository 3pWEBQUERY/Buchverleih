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
import { useLocale } from "@/components/locale-provider";
import { CIRCLES } from "@/lib/i18n/messages/circles";

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
  const f = CIRCLES[useLocale()].form;
  return (
    <div className="space-y-7">
      <Field label={f.name} error={nameError} hint={f.nameHint}>
        <Input value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      </Field>
      <Field label={<>{f.description} <span className="text-muted font-normal">{f.optional}</span></>} hint={f.descHint(280 - v.description.length)}>
        <Textarea rows={3} maxLength={280} value={v.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div>
        <p className="font-medium text-[15px]">{f.loanDays}</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">{f.loanDaysHint}</p>
        <div role="radiogroup" aria-label={f.loanDays} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([14, 28, 42, 56] as const).map((d) => (
            <OptionCard key={d} compact on={v.loanDays === d} onClick={() => set({ loanDays: d })} title={f.days(d)} desc={f.weeks(d / 7)} />
          ))}
        </div>
      </div>
      <div className="rounded-[10px] border border-line px-4">
        <Switch checked={v.autoAccept} onChange={(b) => set({ autoAccept: b })} label={<span className="font-medium text-[15px]">{f.autoAccept}</span>}
          hint={f.autoAcceptHint} />
      </div>
      <Field label={<>{f.spot} <span className="text-muted font-normal">{f.optional}</span></>} hint={f.spotHint}>
        <Input value={v.fixedSpot} maxLength={80} onChange={(e) => set({ fixedSpot: e.target.value })} autoComplete="off" />
      </Field>
      <div>
        <p className="font-medium text-[15px]">{f.join}</p>
        <p className="text-[13px] text-muted mt-0.5 mb-3">{f.joinHint}</p>
        <div role="radiogroup" aria-label={f.join} className="grid sm:grid-cols-2 gap-2">
          <OptionCard on={v.joinMode === "link"} onClick={() => set({ joinMode: "link" })} title={f.byLink} desc={f.byLinkDesc} />
          <OptionCard on={v.joinMode === "approval"} onClick={() => set({ joinMode: "approval" })} title={f.byApproval} desc={f.byApprovalDesc} />
        </div>
      </div>
    </div>
  );
}

export function CircleForm() {
  const router = useRouter();
  const t = CIRCLES[useLocale()];
  const f = t.form;
  const toast = useToast();
  const [v, setV] = useState<CircleValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (v.name.trim().length < 2) {
      setNameError(f.nameError);
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
      toast.show({ text: f.founded(v.name.trim()) });
      router.push(`/kreise/${r.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {t.back}
      </Link>
      <header className="anim-rise">
        <p className="eyebrow">{t.title}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-2">{f.heading[0]}<em>{f.heading[1]}</em></h1>
        <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-xl">{f.lead}</p>
      </header>
      <form onSubmit={submit} noValidate className="mt-10">
        <StepSection n={1} first title={f.setup} desc={f.setupDesc}>
          <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
          <div className="mt-8 pt-6 border-t border-line">
            <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
              {busy ? f.founding : f.found}
            </Button>
          </div>
        </StepSection>
      </form>
    </div>
  );
}
