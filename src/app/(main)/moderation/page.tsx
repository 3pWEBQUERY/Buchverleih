import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import * as moderation from "@/lib/moderation";
import { correctionCurrent, targetLinks } from "@/lib/moderation-queries";
import { ago, fmtDayTime } from "@/lib/dates";
import { caseResponseLabel, reportReasonLabel } from "@/lib/i18n/de-CH";
import { Button, Empty, Input, Notice, PageTitle, cx } from "@/components/ui";
import { CorrectionActions, FlagSwitch, ReportActions } from "@/components/moderation/actions";
import { ModTabs, TABS, type Tab } from "./tabs";
import { actionLabel, caseKindLabel, caseStageLabel, fieldLabel, flagLabel, targetTypeLabel } from "./labels";

export const metadata = { title: "Moderation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  const user = await pageUser("/moderation");
  if (user.role === "member") notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.ansicht)?.id ?? "warteschlange");

  return (
    <div>
      <PageTitle sub="Fälle, Meldungen, Konten und Betrieb. Jeder Eingriff steht im Protokoll.">Moderation</PageTitle>
      <ModTabs active={tab} />
      <div className="mt-8 md:mt-10">
        {tab === "warteschlange" && <Queue />}
        {tab === "kennzahlen" && <Kpis />}
        {tab === "schalter" && <Flags />}
        {tab === "konten" && <Accounts q={sp.q ?? ""} />}
        {tab === "protokoll" && <Log />}
      </div>
    </div>
  );
}

function Block({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-xl md:text-2xl">{title}</h2>
        {count !== undefined && <span className="text-sm text-muted tnum">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ Warteschlange */
async function Queue() {
  const q = await moderation.queue();
  const [links, current] = await Promise.all([targetLinks(q.reports), correctionCurrent(q.corrections.map((c) => c.id))]);
  if (!q.cases.length && !q.reports.length && !q.corrections.length) {
    return <Empty text="Die Warteschlange ist leer. Keine offenen Fälle, Meldungen oder Korrekturen." action={<Link href="/moderation?ansicht=protokoll" className="text-sm underline">Protokoll ansehen</Link>} />;
  }
  return (
    <>
      <Block title="Fälle" count={q.cases.length}>
        {q.cases.length ? (
          <ul className="divide-y divide-line border-b border-line">
            {q.cases.map((c) => (
              <li key={c.id}>
                <Link href={`/moderation/vorgang/${c.loan_id}`} className="group grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] hover:bg-paper-2 -mx-2 px-2 rounded-xs">
                  <span className="min-w-0">
                    <span className="block font-serif text-lg leading-snug group-hover:underline">{c.title}</span>
                    <span className="block text-sm text-ink-2 mt-0.5">
                      {caseKindLabel[c.kind] ?? c.kind} · {c.owner} verleiht an {c.borrower}
                      {c.response && <> · Antwort: {caseResponseLabel[c.response as keyof typeof caseResponseLabel] ?? c.response}</>}
                    </span>
                  </span>
                  <span className="text-sm sm:text-right">
                    {c.needs_decision
                      ? <span className="block text-late font-medium">Braucht Entscheidung</span>
                      : <span className="block text-ink-2">{caseStageLabel(c.stage)}</span>}
                    <span className="block text-muted">Eröffnet {ago(c.opened_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="py-4 text-ink-2">Keine offenen Fälle.</p>}
      </Block>

      <Block title="Meldungen" count={q.reports.length}>
        {q.reports.length ? (
          <ul className="divide-y divide-line border-b border-line">
            {q.reports.map((r) => {
              const href = links[`${r.target_type}:${r.target_id}`];
              return (
                <li key={r.id} className="grid gap-x-6 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-[15px]">
                      <span className="font-medium">{reportReasonLabel[r.reason as keyof typeof reportReasonLabel] ?? r.reason}</span>
                      <span className="text-ink-2"> · {targetTypeLabel[r.target_type] ?? r.target_type}</span>
                      {href && <> · <Link href={href} className="underline">ansehen</Link></>}
                    </p>
                    {r.note && <p className="text-sm text-ink-2 mt-1 max-w-prose">«{r.note}»</p>}
                    <p className="text-sm text-muted mt-1">{r.reporter ? `Gemeldet von ${r.reporter}` : "Automatisch markiert"} · {ago(r.created_at)}</p>
                  </div>
                  <ReportActions id={r.id} />
                </li>
              );
            })}
          </ul>
        ) : <p className="py-4 text-ink-2">Keine offenen Meldungen.</p>}
      </Block>

      <Block title="Katalogkorrekturen" count={q.corrections.length}>
        {q.corrections.length ? (
          <ul className="divide-y divide-line border-b border-line">
            {q.corrections.map((c) => (
              <li key={c.id} className="grid gap-x-6 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-snug">{c.title}</p>
                  <p className="text-sm mt-1">
                    <span className="text-muted">{fieldLabel[c.field] ?? c.field}: </span>
                    {current[c.id] && <><span className="line-through text-muted">{current[c.id]}</span> → </>}
                    <span className="font-medium">{c.suggestion}</span>
                  </p>
                  <p className="text-sm text-muted mt-1">{ago(c.created_at)}</p>
                </div>
                <CorrectionActions id={c.id} />
              </li>
            ))}
          </ul>
        ) : <p className="py-4 text-ink-2">Keine offenen Korrekturen.</p>}
      </Block>
    </>
  );
}

/* ---------------------------------------------------------------- Kennzahlen */
type Kpi = { label: string; def: string; value: number | null; unit: string; target: string; ok: (v: number) => boolean; digits?: number };

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** Dezimalkomma wie in den Zielwerten des PRD («0,5 %»), Tausender mit ’ */
const fmt = (n: number, digits = 1) => n.toLocaleString("de-CH", { maximumFractionDigits: digits }).replace(".", ",");

async function Kpis() {
  const k = await moderation.kpis();
  const lastRun = k.deadlines_last_run ? new Date(k.deadlines_last_run as string) : null;
  const stale = !lastRun || Date.now() - lastRun.getTime() > 2 * 3600_000;
  const rows: Kpi[] = [
    { label: "Annahmequote", def: "Angenommene / gestellte Anfragen", value: num(k.acceptance_rate), unit: " %", target: "≥ 60 %", ok: (v) => v >= 60 },
    { label: "Antwortzeit", def: "Median von Anfrage bis Antwort", value: num(k.median_response_hours), unit: " Std.", target: "< 12 Std.", ok: (v) => v < 12 },
    { label: "Pünktliche Rückgabe", def: "Rückgaben bis Fälligkeit + 3 Tage", value: num(k.on_time_rate), unit: " %", target: "≥ 85 %", ok: (v) => v >= 85 },
    { label: "Streitfallquote", def: "Leihen mit eröffnetem Fall", value: num(k.dispute_rate), unit: " %", target: "< 2 %", ok: (v) => v < 2, digits: 2 },
    { label: "Verlustquote", def: "Leihen, die als verloren enden", value: num(k.loss_rate), unit: " %", target: "< 0,5 %", ok: (v) => v < 0.5, digits: 2 },
    { label: "Regaltiefe", def: "Bücher pro aktivem Mitglied (Median)", value: num(k.shelf_depth), unit: "", target: "≥ 8", ok: (v) => v >= 8 },
    { label: "Liquidität", def: "Suchen mit mindestens 1 verfügbaren Treffer im Umkreis von 5 km, 30 Tage", value: num(k.liquidity), unit: " %", target: "≥ 40 %", ok: (v) => v >= 40 },
    { label: "Wiederkehr", def: "Mitglieder mit 2. Leihe innert 60 Tagen", value: num(k.return_rate), unit: " %", target: "≥ 35 %", ok: (v) => v >= 35 },
  ];
  const stock: [string, string][] = [
    ["Mitglieder", fmt(num(k.members) ?? 0, 0)],
    ["Bücher im Regal", fmt(num(k.copies) ?? 0, 0)],
    ["Kreise", fmt(num(k.circles) ?? 0, 0)],
    ["Anteil Leihen in Kreisen", num(k.circle_share) === null ? "–" : `${fmt(num(k.circle_share)!)} %`],
    ["Versand gewünscht", fmt(num(k.shipping_interest) ?? 0, 0)],
  ];

  return (
    <div>
      {stale && (
        <Notice tone="late" className="mb-10 max-w-2xl">
          <p className="font-medium">Der Fristenlauf {lastRun ? `lief zuletzt ${ago(lastRun)} (${fmtDayTime(lastRun)})` : "ist noch nie gelaufen"}.</p>
          <p className="text-sm text-ink-2 mt-0.5">Erinnerungen, verfallene Anfragen und automatische Fälle bleiben liegen. Prüfe den Worker-Dienst.</p>
        </Notice>
      )}

      <section className="border-b border-line pb-10 mb-10">
        <p className="eyebrow">Leitkennzahl</p>
        <p className="display text-7xl md:text-9xl tnum mt-3">{fmt(num(k.completed_week) ?? 0, 0)}</p>
        <p className="text-ink-2 mt-3 max-w-md">Abgeschlossene Leihen in den letzten 7 Tagen. Rückgabe von beiden bestätigt.</p>
      </section>

      <section className="mb-12">
        <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
          <h2 className="text-xl md:text-2xl">Kennzahlen</h2>
          <span className="text-sm text-muted">Ziel nach 6 Monaten Beta</span>
        </div>
        <table className="hidden md:table w-full text-[15px] border-collapse">
          <thead>
            <tr className="text-left text-sm text-muted border-b border-line">
              <th className="font-normal py-2 pr-4">Kennzahl</th>
              <th className="font-normal py-2 pr-4 hidden lg:table-cell">Definition</th>
              <th className="font-normal py-2 pr-4 text-right">Wert</th>
              <th className="font-normal py-2 pr-4 text-right">Ziel</th>
              <th className="font-normal py-2 text-right">Stand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label} className="align-baseline">
                <td className="py-3 pr-4">
                  <span className="block">{r.label}</span>
                  <span className="block text-sm text-muted lg:hidden">{r.def}</span>
                </td>
                <td className="py-3 pr-4 text-sm text-muted hidden lg:table-cell">{r.def}</td>
                <td className="py-3 pr-4 text-right tnum text-lg font-serif whitespace-nowrap">{r.value === null ? "–" : `${fmt(r.value, r.digits)}${r.unit}`}</td>
                <td className="py-3 pr-4 text-right text-muted whitespace-nowrap">{r.target}</td>
                <td className={cx("py-3 text-right text-sm whitespace-nowrap", r.value === null ? "text-muted" : r.ok(r.value) ? "text-ok" : "text-late")}>
                  {r.value === null ? "Keine Daten" : r.ok(r.value) ? "Erreicht" : "Unter Ziel"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="md:hidden divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label} className="py-4">
              <p className="text-[15px]">{r.label}</p>
              <p className="text-sm text-muted">{r.def}</p>
              <div className="flex items-baseline justify-between gap-4 mt-2">
                <span className="font-serif text-2xl tnum">{r.value === null ? "–" : `${fmt(r.value, r.digits)}${r.unit}`}</span>
                <span className="text-sm text-right">
                  <span className="text-muted">Ziel {r.target} · </span>
                  <span className={r.value === null ? "text-muted" : r.ok(r.value) ? "text-ok" : "text-late"}>
                    {r.value === null ? "Keine Daten" : r.ok(r.value) ? "Erreicht" : "Unter Ziel"}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted mt-3 max-w-prose">Die Zielwerte sind Startschätzungen ohne Vergleichsdaten. Sie werden nach den ersten 200 Leihen neu gesetzt.</p>
      </section>

      <section>
        <div className="border-b border-line-strong pb-2">
          <h2 className="text-xl md:text-2xl">Bestand und Nachfrage</h2>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 pt-5">
          {stock.map(([label, value]) => (
            <div key={label} className="pr-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-serif text-3xl tnum mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        {!stale && lastRun && <p className="text-sm text-muted mt-8">Fristenlauf zuletzt {ago(lastRun)}.</p>}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Schalter */
async function Flags() {
  const flags = await moderation.flags();
  const regions = [...new Map(flags.map((f) => [f.region_id, { id: f.region_id, name: f.region_name, enabled: f.region_enabled }])).values()];
  if (!regions.length) return <Empty text="Es sind noch keine Regionen angelegt." />;
  return (
    <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
      {regions.map((r) => (
        <section key={r.id}>
          <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
            <h2 className="text-xl md:text-2xl">{r.name}</h2>
            <span className={cx("text-sm", r.enabled ? "text-ok" : "text-muted")}>{r.enabled ? "Offen" : "Geschlossen"}</span>
          </div>
          <div className="border-b border-line">
            <FlagSwitch regionId={r.id} flagKey="__region" checked={r.enabled} label="Region offen"
              hint="Neue Mitglieder mit Postleitzahl aus dieser Region können beitreten." />
          </div>
          <div className="divide-y divide-line border-b border-line">
            {flags.filter((f) => f.region_id === r.id).map((f) => (
              <FlagSwitch key={f.key} regionId={r.id} flagKey={f.key} checked={f.enabled}
                label={flagLabel[f.key]?.[0] ?? f.key} hint={flagLabel[f.key]?.[1]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- Konten */
async function Accounts({ q }: { q: string }) {
  const users = await moderation.findUsers(q);
  return (
    <div className="max-w-3xl">
      <form action="/moderation" method="get" role="search" className="flex items-center gap-3">
        <input type="hidden" name="ansicht" value="konten" />
        <label className="sr-only" htmlFor="mod-q">Vorname oder E-Mail</label>
        <Input id="mod-q" name="q" defaultValue={q} placeholder="Vorname oder E-Mail" autoComplete="off" />
        <Button type="submit">Suchen</Button>
      </form>
      <p className="text-sm text-muted mt-6 mb-2">{q ? `${users.length} ${users.length === 1 ? "Treffer" : "Treffer"} für «${q}»` : "Neueste Konten"}</p>
      {users.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/moderation/konto/${u.id}`} className="flex items-center justify-between gap-6 py-3 -mx-2 px-2 hover:bg-paper-2 rounded-xs">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{u.first_name || "Ohne Namen"}</span>
                  <span className="block text-sm text-muted truncate">{u.email}{u.municipality ? ` · ${u.municipality}` : ""}</span>
                </span>
                {u.banned_at && <span className="text-sm text-late shrink-0">Gesperrt</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={`Kein Konto passt zu «${q}».`} action={<Link href="/moderation?ansicht=konten" className="text-sm underline">Suche leeren</Link>} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Protokoll */
async function Log() {
  const log = await moderation.moderationLog(100);
  if (!log.length) return <Empty text="Noch keine Eingriffe protokolliert." />;
  const [links, flagRows] = await Promise.all([
    targetLinks(log as unknown as { target_type: string; target_id: string }[]),
    moderation.flags(),
  ]);
  const regionNames = Object.fromEntries(flagRows.map((f) => [f.region_id, f.region_name]));
  return (
    <ol className="divide-y divide-line border-y border-line">
      {log.map((e) => {
        const href = links[`${e.target_type}:${e.target_id}`];
        const target = e.target_type === "flag" ? flagTarget(String(e.target_id), regionNames) : targetTypeLabel[e.target_type as string] ?? e.target_type;
        return (
          <li key={e.id as string} className="grid gap-x-6 gap-y-0.5 py-3 text-[15px] sm:grid-cols-[11rem_minmax(0,1fr)]">
            <span className="text-sm text-muted sm:pt-px">{fmtDayTime(e.created_at as Date)}</span>
            <span className="min-w-0">
              <span className="font-medium">{actionLabel[e.action as string] ?? e.action}</span>
              <span className="text-ink-2"> · {href ? <Link href={href} className="underline">{target}</Link> : target}</span>
              <span className="text-muted"> · {e.moderator}</span>
              {e.note && <span className="block text-sm text-ink-2 mt-0.5">{e.note}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function flagTarget(t: string, regions: Record<string, string>) {
  const [region, key] = t.split(":");
  return `${regions[region] ?? region} · ${key === "__region" ? "Region" : flagLabel[key]?.[0] ?? key}`;
}
