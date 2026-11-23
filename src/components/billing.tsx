"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { BILLING } from "@/lib/i18n/messages/billing";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button, Input, Notice, cx } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { fmtDay } from "@/lib/dates";

type Sub = { amount: number | null; interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;

async function go(path: string, body: unknown, toastError: (m: string) => void, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const r = await api<{ url: string }>(path, { body });
    window.location.assign(r.url);
  } catch (e) {
    toastError((e as Error).message);
    setBusy(false);
  }
}

function Perks({ items }: { items: string[] }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-body-sm text-ink-2">
      {items.map((p) => <li key={p} className="flex gap-2"><IconCheck width={15} height={15} className="text-ok flex-none mt-1" />{p}</li>)}
    </ul>
  );
}

/** Fördermitgliedschaft in den Einstellungen */
export function SupporterCard({ sub, prices, enabled, justPaid }: { sub: Sub; prices: { month: number; year: number }; enabled: boolean; justPaid: boolean }) {
  const l = useLocale();
  const t = BILLING[l];
  const s = t.supporter;
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Nach der Rückkehr von Stripe kann der Webhook noch unterwegs sein: kurz nachladen
  useEffect(() => {
    if (!justPaid || sub) return;
    const id = setInterval(() => router.refresh(), 3000);
    const stop = setTimeout(() => clearInterval(id), 30_000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [justPaid, sub, router]);

  if (sub) {
    return (
      <div className="rounded-md border border-accent/30 bg-accent-soft/30 p-5 space-y-3 max-w-2xl">
        <p className="font-medium">{s.active}</p>
        {justPaid && <p className="text-body-sm text-ink-2" role="status">{s.thanks}</p>}
        {sub.current_period_end && <p className="text-body-sm text-muted">{sub.cancel_at_period_end ? s.ends(fmtDay(sub.current_period_end, l)) : s.renews(fmtDay(sub.current_period_end, l))}</p>}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => go("/billing/portal", { returnPath: "/einstellungen#foerdern" }, toast.error, setBusy)}>{s.manage}</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-body-sm text-ink-2">{s.desc}</p>
      <Perks items={s.perks} />
      {justPaid && <p className="text-body-sm text-ink-2" role="status">{s.pending}</p>}
      {enabled ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={busy} onClick={() => go("/billing/checkout", { kind: "supporter", interval: "month" }, toast.error, setBusy)}>{s.month(t.chf(prices.month))}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => go("/billing/checkout", { kind: "supporter", interval: "year" }, toast.error, setBusy)}>
              {s.year(t.chf(prices.year))} <span className="text-meta opacity-80">· {s.yearHint}</span>
            </Button>
          </div>
          <p className="text-meta text-muted">{busy ? t.redirect : t.secure}</p>
        </>
      ) : <Notice>{t.soon}</Notice>}
    </div>
  );
}

/** Kreis für Organisationen (nur Admins sehen das Angebot) */
export function OrgCard({ circleId, active, payer, price, enabled }: { circleId: string; active: boolean; payer: boolean; price: number; enabled: boolean }) {
  const l = useLocale();
  const t = BILLING[l];
  const o = t.org;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (active) {
    return (
      <div className="space-y-3">
        <p className="font-medium">{o.active}</p>
        {payer
          ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => go("/billing/portal", { returnPath: `/kreise/${circleId}#organisation` }, toast.error, setBusy)}>{o.manage}</Button>
          : <p className="text-body-sm text-muted">{o.managedBy}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-body-sm text-ink-2">{o.desc}</p>
      <Perks items={o.perks} />
      {enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => go("/billing/checkout", { kind: "organization", circleId }, toast.error, setBusy)}>{o.start}</Button>
          <span className="text-body-sm text-muted">{o.price(t.chf(price))}</span>
        </div>
      ) : <Notice>{t.soon}</Notice>}
    </div>
  );
}

/** Moderation › Schalter: Preise für neue Abschlüsse (nur Admins) */
export function PriceEditor({ prices, admin }: { prices: Record<string, number>; admin: boolean }) {
  const l = useLocale();
  const t = BILLING[l].prices;
  const toast = useToast();
  const router = useRouter();
  const [vals, setVals] = useState(() => Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, (v / 100).toFixed(2)])));
  const keys = ["supporter_month", "supporter_year", "org_month", "shipping_fee"] as const;
  async function save(key: string) {
    const amount = Math.round(Number(vals[key].replace(",", ".")) * 100);
    try {
      await api("/mod", { body: { action: "price", key, amount } });
      toast.show({ text: t.saved });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="divide-y divide-line rounded-md border border-line px-5 md:px-6 max-w-2xl">
      {keys.map((k) => (
        <div key={k} className="py-3 flex flex-wrap items-center justify-between gap-3">
          <label htmlFor={`price-${k}`} className="text-body-sm">{t[k]}</label>
          <div className="flex items-center gap-2">
            <span className="text-meta text-muted">CHF</span>
            <Input id={`price-${k}`} inputMode="decimal" disabled={!admin} value={vals[k] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              className={cx("w-28 h-10 text-body tnum")} />
            {admin && <Button size="sm" variant="secondary" onClick={() => save(k)}>{t.save}</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}
