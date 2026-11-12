import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import * as moderation from "@/lib/moderation";
import { correctionCurrent, targetLinks } from "@/lib/moderation-queries";
import { ago, fmtDayTime } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { MOD } from "@/lib/i18n/messages/moderation";
import { Button, Empty, Input, LinkButton, Notice, PageTitle, cx } from "@/components/ui";
import { StatTile as StatTileNew, StepSection } from "@/components/step-section";
import { Monogram } from "@/components/person/monogram";
import { IconArrowRight, IconCheck, IconSearch } from "@/components/icons";
import { Chip, PriorityChip, Quiet, StatTile, type Priority } from "@/components/moderation/ui";
import { CorrectionActions, FlagSwitch, ReportActions } from "@/components/moderation/actions";
import { ModTabs, TABS, type Tab } from "./tabs";
import { caseStageLabel, modLabels } from "./labels";

export async function generateMetadata() {
  return { title: MOD[await getLocale()].title };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  const user = await pageUser("/moderation");
  if (user.role === "member") notFound();
  const sp = await searchParams;
  const l = await getLocale();
  const t = MOD[l].overview;
  const tab: Tab = (TABS.find((t) => t.id === sp.ansicht)?.id ?? "warteschlange");
  const q = await moderation.queue();
  const open = q.cases.length + q.reports.length + q.corrections.length;
  const urgent = q.cases.filter((c) => c.needs_decision).length + q.reports.filter((r) => reportPriority(r) === "hoch").length;

  return (
    <div>
      <PageTitle
        eyebrow={t.eyebrow(user.role === "admin")}
        sub={t.sub}
        aside={
          <dl className="grid grid-cols-2 gap-2 anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTileNew n={open} label={t.open} href="/moderation" />
            <div className={cx("relative rounded-[8px] px-4 py-3 min-w-[92px] flex flex-col-reverse justify-end", urgent > 0 ? "bg-late/10 text-late" : "bg-paper-2")}>
              <dt className={cx("text-[12px] mt-1.5", urgent > 0 ? "text-late" : "text-muted")}>{t.urgent}</dt>
              <dd className="text-[24px] md:text-[28px] font-[560] tracking-[-0.04em] leading-none tnum">{urgent}</dd>
            </div>
          </dl>
        }>
        {t.heading[0]}<em>{t.heading[1]}</em>
      </PageTitle>
      <ModTabs active={tab} counts={{ warteschlange: open }} l={l} />
      <div className="mt-4">
        {tab === "warteschlange" && <Queue q={q} l={l} />}
        {tab === "kennzahlen" && <Kpis l={l} />}
        {tab === "schalter" && <Flags l={l} />}
        {tab === "konten" && <Accounts q={sp.q ?? ""} l={l} />}
        {tab === "protokoll" && <Log l={l} />}
      </div>
    </div>
  );
}

type QueueData = Awaited<ReturnType<typeof moderation.queue>>;

/** Meldungen zu Belästigung oder älter als 48 Stunden zuerst */
function reportPriority(r: QueueData["reports"][number]): Priority {
  return r.reason === "harassment" || Date.now() - new Date(r.created_at).getTime() > 48 * 3600_000 ? "hoch" : "mittel";
}

/* ------------------------------------------------------------ Warteschlange */
async function Queue({ q, l }: { q: QueueData; l: Locale }) {
  const t = MOD[l].queue;
  const ml = modLabels(l);
  const L = labels(l);
  const [links, current] = await Promise.all([targetLinks(q.reports), correctionCurrent(q.corrections.map((c) => c.id))]);
  if (!q.cases.length && !q.reports.length && !q.corrections.length) {
    return (
      <div className="rounded-[10px] border border-line px-6 py-8 md:px-8 md:py-10 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="h-12 w-12 rounded-full bg-accent-soft text-accent-hover grid place-items-center flex-none anim-pop"><IconCheck width={22} height={22} /></span>
          <div>
            <p className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-none">{t.allDone}</p>
            <p className="text-ink-2 mt-2">{t.allDoneText}</p>
          </div>
        </div>
        <LinkButton href="/moderation?ansicht=protokoll" variant="secondary">{t.toLog}</LinkButton>
      </div>
    );
  }
  const reports = [...q.reports].sort((a, b) => (reportPriority(a) === "hoch" ? 0 : 1) - (reportPriority(b) === "hoch" ? 0 : 1));
  return (
    <div>
      <StepSection id="q-faelle" n={1} first title={t.cases} aside={t.nOpen(q.cases.length)} desc={t.casesDesc}>
        {q.cases.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {q.cases.map((c, i) => (
              <li key={c.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link href={`/moderation/vorgang/${c.loan_id}`}
                  className={cx("group rounded-[10px] border p-5 flex flex-col h-full transition-colors", c.needs_decision ? "border-late/40 hover:border-late" : "border-line hover:border-accent")}>
                  <div className="flex items-center justify-between gap-3">
                    <PriorityChip p={c.needs_decision ? "hoch" : "normal"} l={l} />
                    <span className="text-[13px] text-muted">{t.opened(ago(c.opened_at, l))}</span>
                  </div>
                  <p className="font-serif text-[20px] leading-[1.15] mt-3.5 group-hover:underline decoration-1 underline-offset-4">{c.title}</p>
                  <p className="text-[14px] text-ink-2 mt-2">
                    {ml.caseKind[c.kind] ?? c.kind} · {t.lends(c.owner, c.borrower)}
                  </p>
                  <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-muted">
                      {c.needs_decision ? t.needsDecision : caseStageLabel(c.stage, l)}
                      {c.response && <> · {t.answer}{L.caseResponseLabel[c.response as keyof typeof L.caseResponseLabel] ?? c.response}</>}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-hover transition-transform duration-200 group-hover:translate-x-0.5">{t.open} <IconArrowRight width={15} height={15} /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Quiet>{t.noCases}</Quiet>}
      </StepSection>

      <StepSection id="q-meldungen" n={2} title={t.reports} aside={t.nOpen(q.reports.length)} desc={t.reportsDesc}>
        {reports.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {reports.map((r, i) => {
              const href = links[`${r.target_type}:${r.target_id}`];
              const p = reportPriority(r);
              return (
                <li key={r.id} className={cx("rounded-[10px] border p-5 flex flex-col anim-rise", p === "hoch" ? "border-late/40" : "border-line")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className="flex items-center justify-between gap-3">
                    <PriorityChip p={p} l={l} />
                    <span className="text-[13px] text-muted">{ago(r.created_at, l)}</span>
                  </div>
                  <p className="font-medium text-[17px] mt-3.5">{L.reportReasonLabel[r.reason as keyof typeof L.reportReasonLabel] ?? r.reason}</p>
                  <p className="text-[14px] text-ink-2 mt-1">
                    {ml.targetType[r.target_type] ?? r.target_type}
                    {href && <> · <Link href={href} className="font-medium text-accent-hover hover:underline underline-offset-4">{t.view}</Link></>}
                    {" · "}{r.reporter ? t.reportedBy(r.reporter) : t.autoFlagged}
                  </p>
                  {r.note && <p className="text-[15px] mt-3 border-l-2 border-line-strong pl-3 text-ink-2">«{r.note}»</p>}
                  <div className="mt-auto pt-5"><ReportActions id={r.id} /></div>
                </li>
              );
            })}
          </ul>
        ) : <Quiet>{t.noReports}</Quiet>}
      </StepSection>

      <StepSection id="q-korrekturen" n={3} title={t.corrections} aside={t.nOpen(q.corrections.length)} desc={t.correctionsDesc}>
        {q.corrections.length ? (
          <ul className="rounded-[10px] border border-line divide-y divide-line">
            {q.corrections.map((c) => (
              <li key={c.id} className="p-5 md:px-6 grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <PriorityChip p="niedrig" l={l} />
                    <span className="text-[13px] text-muted">{ago(c.created_at, l)}</span>
                  </div>
                  <p className="font-serif text-[19px] leading-tight mt-3">{c.title}</p>
                  <p className="text-[14.5px] mt-1.5">
                    <span className="text-muted">{ml.field[c.field] ?? c.field}: </span>
                    {current[c.id] && <><span className="line-through text-muted">{current[c.id]}</span> <span className="text-muted">→</span> </>}
                    <span className="font-medium">{c.suggestion}</span>
                  </p>
                </div>
                <CorrectionActions id={c.id} />
              </li>
            ))}
          </ul>
        ) : <Quiet>{t.noCorrections}</Quiet>}
      </StepSection>
    </div>
  );
}

/* ---------------------------------------------------------------- Kennzahlen */
type Kpi = { label: string; def: string; value: number | null; unit: string; target: string; goal: number; dir: "min" | "max"; digits?: number };

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** Dezimalkomma wie in den Zielwerten des PRD («0,5 %»), Tausender mit ’ */
const fmt = (n: number, digits = 1) => n.toLocaleString("de-CH", { maximumFractionDigits: digits }).replace(".", ",");
const reached = (k: Kpi) => k.value !== null && (k.dir === "min" ? k.value >= k.goal : k.value < k.goal);

async function Kpis({ l }: { l: Locale }) {
  const t = MOD[l].kpi;
  const k = await moderation.kpis();
  const lastRun = k.deadlines_last_run ? new Date(k.deadlines_last_run as string) : null;
  const stale = !lastRun || Date.now() - lastRun.getTime() > 2 * 3600_000;
  const rows: Kpi[] = [
    { label: t.rows.acceptance[0], def: t.rows.acceptance[1], value: num(k.acceptance_rate), unit: " %", target: "≥ 60 %", goal: 60, dir: "min" },
    { label: t.rows.response[0], def: t.rows.response[1], value: num(k.median_response_hours), unit: t.hours, target: `< 12 ${t.hoursShort}`, goal: 12, dir: "max" },
    { label: t.rows.onTime[0], def: t.rows.onTime[1], value: num(k.on_time_rate), unit: " %", target: "≥ 85 %", goal: 85, dir: "min" },
    { label: t.rows.dispute[0], def: t.rows.dispute[1], value: num(k.dispute_rate), unit: " %", target: "< 2 %", goal: 2, dir: "max", digits: 2 },
    { label: t.rows.loss[0], def: t.rows.loss[1], value: num(k.loss_rate), unit: " %", target: "< 0,5 %", goal: 0.5, dir: "max", digits: 2 },
    { label: t.rows.depth[0], def: t.rows.depth[1], value: num(k.shelf_depth), unit: "", target: "≥ 8", goal: 8, dir: "min" },
    { label: t.rows.liquidity[0], def: t.rows.liquidity[1], value: num(k.liquidity), unit: " %", target: "≥ 40 %", goal: 40, dir: "min" },
    { label: t.rows.returning[0], def: t.rows.returning[1], value: num(k.return_rate), unit: " %", target: "≥ 35 %", goal: 35, dir: "min" },
  ];
  const stock: [string, string][] = [
    [t.stock.members, fmt(num(k.members) ?? 0, 0)],
    [t.stock.copies, fmt(num(k.copies) ?? 0, 0)],
    [t.stock.circles, fmt(num(k.circles) ?? 0, 0)],
    [t.stock.circleShare, num(k.circle_share) === null ? "–" : `${fmt(num(k.circle_share)!)} %`],
    [t.stock.shipping, fmt(num(k.shipping_interest) ?? 0, 0)],
  ];
  const hit = rows.filter(reached).length;
  const known = rows.filter((r) => r.value !== null).length;

  return (
    <div className="space-y-10">
      {stale && (
        <Notice tone="late" className="max-w-2xl">
          <p className="font-semibold">{lastRun ? t.staleRan(ago(lastRun, l), fmtDayTime(lastRun, l)) : t.staleNever}</p>
          <p className="text-sm text-ink-2 mt-0.5">{t.staleText}</p>
        </Notice>
      )}

      <section className="surface-night rounded-[12px] p-6 md:p-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end anim-rise">
        <div>
          <p className="eyebrow !text-night-muted">{t.leadEyebrow}</p>
          <p className="display text-[64px] md:text-[88px] tnum mt-3 leading-[0.9]">{fmt(num(k.completed_week) ?? 0, 0)}</p>
          <p className="text-night-muted text-[15px] mt-4 max-w-md">{t.leadText}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-1 md:text-right">
          <div>
            <dd className="font-[520] tracking-[-0.035em] text-[32px] md:text-[36px] leading-none tnum">{hit}<span className="text-night-muted">/{rows.length}</span></dd>
            <dt className="text-[13px] text-night-muted mt-1.5">{t.goalsReached}</dt>
          </div>
          <div>
            <dd className="font-[520] tracking-[-0.035em] text-[32px] md:text-[36px] leading-none tnum">{rows.length - known}</dd>
            <dt className="text-[13px] text-night-muted mt-1.5">{t.noData}</dt>
          </div>
        </dl>
      </section>

      <StepSection id="kpi-t" n={1} title={t.title} aside={t.aside} desc={t.desc}>
        <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
          {rows.map((r, i) => <KpiTile key={r.label} k={r} i={i} l={l} />)}
        </ul>
        <p className="text-sm text-muted mt-4 max-w-prose">{t.note}</p>
      </StepSection>

      <StepSection id="stock-t" n={2} title={t.stockTitle} aside={!stale && lastRun ? t.lastRun(ago(lastRun, l)) : undefined}>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stock.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
        </dl>
      </StepSection>
    </div>
  );
}

/** Kachel: grosse Zahl, Zielwert und ein Balken. Die Marke zeigt das Ziel. */
function KpiTile({ k, i, l }: { k: Kpi; i: number; l: Locale }) {
  const t = MOD[l].kpi;
  const ok = reached(k);
  // Skala: Prozent-Mindestwerte 0–100, sonst 0 bis doppeltes Ziel (Ziel in der Mitte)
  const max = k.unit === " %" && k.dir === "min" ? 100 : k.goal * 2;
  const fill = k.value === null ? 0 : Math.max(2, Math.min(100, (k.value / max) * 100));
  const mark = (k.goal / max) * 100;
  return (
    <li className="rounded-[10px] border border-line p-5 flex flex-col sm:min-h-[210px] anim-rise" style={{ animationDelay: `${i * 35}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[15px]">{k.label}</p>
          <p className="text-[12.5px] text-muted leading-snug mt-1 line-clamp-2">{k.def}</p>
        </div>
        {k.value === null
          ? <Chip>{t.chipNoData}</Chip>
          : <Chip tone={ok ? "ok" : "late"} strong>{ok ? t.reached : t.below}</Chip>}
      </div>
      <p className="font-[560] tracking-[-0.04em] text-[36px] md:text-[40px] leading-none tnum mt-5">
        {k.value === null ? <span className="text-muted">–</span> : <>{fmt(k.value, k.digits)}<span className="text-[20px] text-muted">{k.unit}</span></>}
      </p>
      <div className="mt-auto pt-5">
        <div className="relative h-2 rounded-full bg-paper-3" aria-hidden>
          <span className={cx("absolute inset-y-0 left-0 rounded-full", k.value === null ? "" : ok ? "bg-ok" : "bg-late")} style={{ width: `${fill}%` }} />
          <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink-2" style={{ left: `calc(${mark}% - 1px)` }} />
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-2.5 text-[12.5px]">
          <span className="text-muted">{k.dir === "min" ? t.higher : t.lower}</span>
          <span className="font-medium whitespace-nowrap tnum">{t.goal} {k.target}</span>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ Schalter */
async function Flags({ l }: { l: Locale }) {
  const t = MOD[l].flags;
  const ml = modLabels(l);
  const flags = await moderation.flags();
  const regions = [...new Map(flags.map((f) => [f.region_id, { id: f.region_id, name: f.region_name, enabled: f.region_enabled }])).values()];
  if (!regions.length) return <Empty text={t.noRegions} />;
  return (
    <div className="grid gap-3 xl:grid-cols-2 items-start">
      {regions.map((r, i) => (
        <section key={r.id} className="rounded-[10px] border border-line overflow-hidden anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center justify-between gap-4 px-5 md:px-6 pt-5 pb-4">
            <div>
              <p className="eyebrow">{t.region}</p>
              <h2 className="text-[20px] font-[560] tracking-[-0.025em] mt-1">{r.name}</h2>
            </div>
            <Chip tone={r.enabled ? "ok" : "done"} strong={r.enabled}>{r.enabled ? t.open : t.closed}</Chip>
          </div>
          <div className="mx-5 md:mx-6 mb-2 px-4 rounded-[10px] bg-paper-2">
            <FlagSwitch regionId={r.id} flagKey="__region" checked={r.enabled} label={<span className="font-medium">{t.regionOpen}</span>}
              hint={t.regionHint} />
          </div>
          <div className="divide-y divide-line px-5 md:px-6 pb-2">
            {flags.filter((f) => f.region_id === r.id).map((f) => (
              <FlagSwitch key={f.key} regionId={r.id} flagKey={f.key} checked={f.enabled}
                label={ml.flag[f.key]?.[0] ?? f.key} hint={ml.flag[f.key]?.[1]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- Konten */
async function Accounts({ q, l }: { q: string; l: Locale }) {
  const t = MOD[l].accounts;
  const [users, team] = await Promise.all([moderation.findUsers(q), moderation.team()]);
  return (
    <div className="max-w-3xl">
      {!q && (
        <section aria-labelledby="team" className="mb-10">
          <p id="team" className="eyebrow mb-3">{t.team} · {team.length}</p>
          <ul className="flex flex-wrap gap-2">
            {team.map((m) => (
              <li key={m.id}>
                <Link href={`/moderation/konto/${m.id}`} className="h-11 pl-1.5 pr-3.5 rounded-[8px] border border-line inline-flex items-center gap-2.5 hover:border-accent transition-colors">
                  <Monogram name={m.first_name || "?"} seed={m.id} size={32} photo={m.avatar_key} />
                  <span className="text-[14px] font-medium">{m.first_name || m.email}</span>
                  <Chip tone={m.role === "admin" ? "ok" : "wait"} className="shrink-0">{m.role === "admin" ? t.admin : t.moderation}</Chip>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-muted mt-3">{t.howTo}</p>
        </section>
      )}
      <form action="/moderation" method="get" role="search" className="flex items-center gap-2">
        <input type="hidden" name="ansicht" value="konten" />
        <label className="sr-only" htmlFor="mod-q">{t.searchLabel}</label>
        <div className="relative flex-1">
          <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input id="mod-q" name="q" defaultValue={q} placeholder={t.searchLabel} autoComplete="off" className="pl-11" />
        </div>
        <Button type="submit" variant="primary" className="h-12">{t.search}</Button>
      </form>
      <p className="eyebrow mt-8 mb-3">{q ? t.hits(users.length, q) : t.newest}</p>
      {users.length ? (
        <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/moderation/konto/${u.id}`} className="group flex items-center gap-4 px-4 md:px-5 py-3.5 hover:bg-paper-2 transition-colors">
                <Monogram name={u.first_name || "?"} seed={u.id} size={40} photo={u.avatar_key} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{u.first_name || t.noName}</span>
                  <span className="block text-sm text-muted truncate">{u.email}{u.municipality ? ` · ${u.municipality}` : ""}</span>
                </span>
                {u.role !== "member" && <Chip tone={u.role === "admin" ? "ok" : "wait"} className="shrink-0">{u.role === "admin" ? t.admin : t.moderation}</Chip>}
                {u.banned_at && <Chip tone="late" strong className="shrink-0">{t.banned}</Chip>}
                <IconArrowRight width={16} height={16} className="text-muted shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent-hover" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={t.none(q)} action={<LinkButton href="/moderation?ansicht=konten" variant="secondary" size="sm">{t.clear}</LinkButton>} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Protokoll */
async function Log({ l }: { l: Locale }) {
  const ml = modLabels(l);
  const log = await moderation.moderationLog(100);
  if (!log.length) return <Empty text={MOD[l].log.empty} />;
  const [links, flagRows] = await Promise.all([
    targetLinks(log as unknown as { target_type: string; target_id: string }[]),
    moderation.flags(),
  ]);
  const regionNames = Object.fromEntries(flagRows.map((f) => [f.region_id, f.region_name]));
  return (
    <ol className="rounded-[10px] border border-line divide-y divide-line">
      {log.map((e) => {
        const href = links[`${e.target_type}:${e.target_id}`];
        const target = e.target_type === "flag" ? flagTarget(String(e.target_id), regionNames, l) : ml.targetType[e.target_type as string] ?? e.target_type;
        return (
          <li key={e.id as string} className="grid gap-x-6 gap-y-1 px-5 py-3.5 text-[15px] sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:items-baseline">
            <span className="text-[13px] text-muted tnum">{fmtDayTime(e.created_at as Date, l)}</span>
            <span className="min-w-0">
              <span className="font-medium">{ml.action[e.action as string] ?? e.action}</span>
              <span className="text-ink-2"> · {href ? <Link href={href} className="text-accent-hover hover:underline underline-offset-4">{target}</Link> : target}</span>
              {e.note && <span className="block text-sm text-ink-2 mt-0.5">{e.note}</span>}
            </span>
            <span className="text-[13px] text-muted">{e.moderator}</span>
          </li>
        );
      })}
    </ol>
  );
}

function flagTarget(t: string, regions: Record<string, string>, l: Locale) {
  const [region, key] = t.split(":");
  return `${regions[region] ?? region} · ${key === "__region" ? MOD[l].log.region : modLabels(l).flag[key]?.[0] ?? key}`;
}
