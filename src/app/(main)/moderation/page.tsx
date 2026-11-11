import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import * as moderation from "@/lib/moderation";
import { correctionCurrent, targetLinks } from "@/lib/moderation-queries";
import { ago, fmtDayTime } from "@/lib/dates";
import { caseResponseLabel, reportReasonLabel } from "@/lib/i18n/de-CH";
import { Button, Empty, Input, LinkButton, Notice, cx } from "@/components/ui";
import { IconArrowRight, IconCheck, IconSearch } from "@/components/icons";
import { Chip, ModHead, PriorityChip, Quiet, StatTile, type Priority } from "@/components/moderation/ui";
import { CorrectionActions, FlagSwitch, ReportActions } from "@/components/moderation/actions";
import { ModTabs, TABS, type Tab } from "./tabs";
import { actionLabel, caseKindLabel, caseStageLabel, fieldLabel, flagLabel, targetTypeLabel } from "./labels";

export const metadata = { title: "Moderation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  const user = await pageUser("/moderation");
  if (user.role === "member") notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.ansicht)?.id ?? "warteschlange");
  const q = await moderation.queue();
  const open = q.cases.length + q.reports.length + q.corrections.length;
  const urgent = q.cases.filter((c) => c.needs_decision).length + q.reports.filter((r) => reportPriority(r) === "hoch").length;

  return (
    <div>
      <header className="mb-8 md:mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Intern · {user.role === "admin" ? "Administration" : "Moderation"}</p>
          <h1 className="display text-[52px] md:text-[84px] mt-3">Moderation</h1>
          <p className="text-ink-2 text-[17px] mt-4 max-w-xl">Fälle, Meldungen, Konten und Betrieb. Jeder Eingriff steht im Protokoll.</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 anim-rise" style={{ animationDelay: "60ms" }}>
          <Link href="/moderation" className="panel-quiet rounded-[14px] px-5 py-4 min-w-[124px] hover:bg-paper-3 transition-colors">
            <dd className="font-serif text-[40px] leading-none tnum">{open}</dd>
            <dt className="text-[13px] text-muted mt-1.5">offen</dt>
          </Link>
          <Link href="/moderation" className={cx("rounded-[14px] px-5 py-4 min-w-[124px] transition-colors", urgent > 0 ? "bg-late/10 text-late hover:bg-late/15" : "panel-quiet hover:bg-paper-3")}>
            <dd className="font-serif text-[40px] leading-none tnum">{urgent}</dd>
            <dt className={cx("text-[13px] mt-1.5", urgent > 0 ? "text-late" : "text-muted")}>dringend</dt>
          </Link>
        </dl>
      </header>
      <ModTabs active={tab} counts={{ warteschlange: open }} />
      <div className="mt-8 md:mt-12">
        {tab === "warteschlange" && <Queue q={q} />}
        {tab === "kennzahlen" && <Kpis />}
        {tab === "schalter" && <Flags />}
        {tab === "konten" && <Accounts q={sp.q ?? ""} />}
        {tab === "protokoll" && <Log />}
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
async function Queue({ q }: { q: QueueData }) {
  const [links, current] = await Promise.all([targetLinks(q.reports), correctionCurrent(q.corrections.map((c) => c.id))]);
  if (!q.cases.length && !q.reports.length && !q.corrections.length) {
    return (
      <div className="panel-quiet rounded-[18px] px-6 py-10 md:px-10 md:py-14 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="h-14 w-14 rounded-full bg-ink text-paper grid place-items-center flex-none anim-pop"><IconCheck width={24} height={24} /></span>
          <div>
            <p className="font-serif text-[32px] md:text-[40px] leading-none">Alles erledigt.</p>
            <p className="text-ink-2 mt-2">Keine offenen Fälle, Meldungen oder Korrekturen.</p>
          </div>
        </div>
        <LinkButton href="/moderation?ansicht=protokoll" variant="ghost">Protokoll ansehen</LinkButton>
      </div>
    );
  }
  const reports = [...q.reports].sort((a, b) => (reportPriority(a) === "hoch" ? 0 : 1) - (reportPriority(b) === "hoch" ? 0 : 1));
  return (
    <div className="space-y-12 md:space-y-14">
      <section aria-labelledby="q-faelle">
        <ModHead id="q-faelle" title="Fälle" count={q.cases.length} aside="Schaden und Nichtrückgabe" />
        {q.cases.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {q.cases.map((c, i) => (
              <li key={c.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link href={`/moderation/vorgang/${c.loan_id}`}
                  className={cx("group panel rounded-[14px] p-5 md:p-6 flex flex-col h-full hover:border-ink transition-colors", c.needs_decision && "border-late/40")}>
                  <div className="flex items-center justify-between gap-3">
                    <PriorityChip p={c.needs_decision ? "hoch" : "normal"} />
                    <span className="text-[13px] text-muted">eröffnet {ago(c.opened_at)}</span>
                  </div>
                  <p className="font-serif text-[26px] leading-[1.05] mt-4 group-hover:underline decoration-1 underline-offset-4">{c.title}</p>
                  <p className="text-[14px] text-ink-2 mt-2">
                    {caseKindLabel[c.kind] ?? c.kind} · {c.owner} verleiht an {c.borrower}
                  </p>
                  <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-muted">
                      {c.needs_decision ? "Braucht Entscheidung" : caseStageLabel(c.stage)}
                      {c.response && <> · Antwort: {caseResponseLabel[c.response as keyof typeof caseResponseLabel] ?? c.response}</>}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5">Öffnen <IconArrowRight width={15} height={15} /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Quiet>Keine offenen Fälle.</Quiet>}
      </section>

      <section aria-labelledby="q-meldungen">
        <ModHead id="q-meldungen" title="Meldungen" count={q.reports.length} aside="Belästigung und Meldungen über 48 Std. zuerst" />
        {reports.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {reports.map((r, i) => {
              const href = links[`${r.target_type}:${r.target_id}`];
              const p = reportPriority(r);
              return (
                <li key={r.id} className={cx("panel rounded-[14px] p-5 md:p-6 flex flex-col anim-rise", p === "hoch" && "border-late/40")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className="flex items-center justify-between gap-3">
                    <PriorityChip p={p} />
                    <span className="text-[13px] text-muted">{ago(r.created_at)}</span>
                  </div>
                  <p className="ui-title text-[19px] mt-4">{reportReasonLabel[r.reason as keyof typeof reportReasonLabel] ?? r.reason}</p>
                  <p className="text-[14px] text-ink-2 mt-1">
                    {targetTypeLabel[r.target_type] ?? r.target_type}
                    {href && <> · <Link href={href} className="underline underline-offset-4 hover:text-ink">ansehen</Link></>}
                    {" · "}{r.reporter ? `gemeldet von ${r.reporter}` : "automatisch markiert"}
                  </p>
                  {r.note && <p className="text-[15px] mt-3 border-l-2 border-line-strong pl-3 text-ink-2">«{r.note}»</p>}
                  <div className="mt-auto pt-5"><ReportActions id={r.id} /></div>
                </li>
              );
            })}
          </ul>
        ) : <Quiet>Keine offenen Meldungen.</Quiet>}
      </section>

      <section aria-labelledby="q-korrekturen">
        <ModHead id="q-korrekturen" title="Katalogkorrekturen" count={q.corrections.length} />
        {q.corrections.length ? (
          <ul className="panel rounded-[14px] divide-y divide-line">
            {q.corrections.map((c) => (
              <li key={c.id} className="p-5 md:px-6 grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <PriorityChip p="niedrig" />
                    <span className="text-[13px] text-muted">{ago(c.created_at)}</span>
                  </div>
                  <p className="font-serif text-[22px] leading-tight mt-3">{c.title}</p>
                  <p className="text-[14.5px] mt-1.5">
                    <span className="text-muted">{fieldLabel[c.field] ?? c.field}: </span>
                    {current[c.id] && <><span className="line-through text-muted">{current[c.id]}</span> <span className="text-muted">→</span> </>}
                    <span className="font-semibold">{c.suggestion}</span>
                  </p>
                </div>
                <CorrectionActions id={c.id} />
              </li>
            ))}
          </ul>
        ) : <Quiet>Keine offenen Korrekturen.</Quiet>}
      </section>
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

async function Kpis() {
  const k = await moderation.kpis();
  const lastRun = k.deadlines_last_run ? new Date(k.deadlines_last_run as string) : null;
  const stale = !lastRun || Date.now() - lastRun.getTime() > 2 * 3600_000;
  const rows: Kpi[] = [
    { label: "Annahmequote", def: "Angenommene / gestellte Anfragen", value: num(k.acceptance_rate), unit: " %", target: "≥ 60 %", goal: 60, dir: "min" },
    { label: "Antwortzeit", def: "Median von Anfrage bis Antwort", value: num(k.median_response_hours), unit: " Std.", target: "< 12 Std.", goal: 12, dir: "max" },
    { label: "Pünktliche Rückgabe", def: "Rückgaben bis Fälligkeit + 3 Tage", value: num(k.on_time_rate), unit: " %", target: "≥ 85 %", goal: 85, dir: "min" },
    { label: "Streitfallquote", def: "Leihen mit eröffnetem Fall", value: num(k.dispute_rate), unit: " %", target: "< 2 %", goal: 2, dir: "max", digits: 2 },
    { label: "Verlustquote", def: "Leihen, die als verloren enden", value: num(k.loss_rate), unit: " %", target: "< 0,5 %", goal: 0.5, dir: "max", digits: 2 },
    { label: "Regaltiefe", def: "Bücher pro aktivem Mitglied (Median)", value: num(k.shelf_depth), unit: "", target: "≥ 8", goal: 8, dir: "min" },
    { label: "Liquidität", def: "Suchen mit mindestens 1 verfügbaren Treffer im Umkreis von 5 km, 30 Tage", value: num(k.liquidity), unit: " %", target: "≥ 40 %", goal: 40, dir: "min" },
    { label: "Wiederkehr", def: "Mitglieder mit 2. Leihe innert 60 Tagen", value: num(k.return_rate), unit: " %", target: "≥ 35 %", goal: 35, dir: "min" },
  ];
  const stock: [string, string][] = [
    ["Mitglieder", fmt(num(k.members) ?? 0, 0)],
    ["Bücher im Regal", fmt(num(k.copies) ?? 0, 0)],
    ["Kreise", fmt(num(k.circles) ?? 0, 0)],
    ["Anteil Leihen in Kreisen", num(k.circle_share) === null ? "–" : `${fmt(num(k.circle_share)!)} %`],
    ["Versand gewünscht", fmt(num(k.shipping_interest) ?? 0, 0)],
  ];
  const hit = rows.filter(reached).length;
  const known = rows.filter((r) => r.value !== null).length;

  return (
    <div className="space-y-12 md:space-y-14">
      {stale && (
        <Notice tone="late" className="max-w-2xl">
          <p className="font-semibold">Der Fristenlauf {lastRun ? `lief zuletzt ${ago(lastRun)} (${fmtDayTime(lastRun)})` : "ist noch nie gelaufen"}.</p>
          <p className="text-sm text-ink-2 mt-0.5">Erinnerungen, verfallene Anfragen und automatische Fälle bleiben liegen. Prüfe den Worker-Dienst.</p>
        </Notice>
      )}

      <section className="surface-night rounded-[22px] p-7 md:p-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end anim-rise">
        <div>
          <p className="eyebrow !text-night-muted">Leitkennzahl · letzte 7 Tage</p>
          <p className="display text-[96px] md:text-[150px] tnum mt-4 leading-[0.8]">{fmt(num(k.completed_week) ?? 0, 0)}</p>
          <p className="text-night-muted text-[16px] mt-5 max-w-md">Abgeschlossene Leihen. Zählt erst, wenn beide die Rückgabe bestätigt haben.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-1 md:text-right">
          <div>
            <dd className="font-serif text-[44px] leading-none tnum">{hit}<span className="text-night-muted">/{rows.length}</span></dd>
            <dt className="text-[13px] text-night-muted mt-1.5">Ziele erreicht</dt>
          </div>
          <div>
            <dd className="font-serif text-[44px] leading-none tnum">{rows.length - known}</dd>
            <dt className="text-[13px] text-night-muted mt-1.5">ohne Daten</dt>
          </div>
        </dl>
      </section>

      <section aria-labelledby="kpi-t">
        <ModHead id="kpi-t" title="Kennzahlen" aside="Ziel nach 6 Monaten Beta" />
        <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((r, i) => <KpiTile key={r.label} k={r} i={i} />)}
        </ul>
        <p className="text-sm text-muted mt-4 max-w-prose">Die Zielwerte sind Startschätzungen ohne Vergleichsdaten. Sie werden nach den ersten 200 Leihen neu gesetzt.</p>
      </section>

      <section aria-labelledby="stock-t">
        <ModHead id="stock-t" title="Bestand und Nachfrage" aside={!stale && lastRun ? `Fristenlauf zuletzt ${ago(lastRun)}` : undefined} />
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stock.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
        </dl>
      </section>
    </div>
  );
}

/** Kachel: grosse Zahl, Zielwert und ein Balken. Die Marke zeigt das Ziel. */
function KpiTile({ k, i }: { k: Kpi; i: number }) {
  const ok = reached(k);
  // Skala: Prozent-Mindestwerte 0–100, sonst 0 bis doppeltes Ziel (Ziel in der Mitte)
  const max = k.unit === " %" && k.dir === "min" ? 100 : k.goal * 2;
  const fill = k.value === null ? 0 : Math.max(2, Math.min(100, (k.value / max) * 100));
  const mark = (k.goal / max) * 100;
  return (
    <li className="panel rounded-[14px] p-5 flex flex-col min-h-[208px] anim-rise" style={{ animationDelay: `${i * 35}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <p className="ui-title text-[15px]">{k.label}</p>
        {k.value === null
          ? <Chip>Keine Daten</Chip>
          : <Chip tone={ok ? "ok" : "late"} strong>{ok ? "Erreicht" : "Unter Ziel"}</Chip>}
      </div>
      <p className="font-serif text-[52px] leading-none tnum mt-4">
        {k.value === null ? <span className="text-muted">–</span> : <>{fmt(k.value, k.digits)}<span className="text-[26px] text-muted">{k.unit}</span></>}
      </p>
      <div className="mt-auto pt-5">
        <div className="relative h-2 rounded-full bg-paper-3" aria-hidden>
          <span className={cx("absolute inset-y-0 left-0 rounded-full", k.value === null ? "" : ok ? "bg-ok" : "bg-late")} style={{ width: `${fill}%` }} />
          <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink" style={{ left: `calc(${mark}% - 1px)` }} />
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-2.5 text-[12.5px]">
          <span className="text-muted line-clamp-1" title={k.def}>{k.def}</span>
          <span className="font-semibold whitespace-nowrap tnum">Ziel {k.target}</span>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ Schalter */
async function Flags() {
  const flags = await moderation.flags();
  const regions = [...new Map(flags.map((f) => [f.region_id, { id: f.region_id, name: f.region_name, enabled: f.region_enabled }])).values()];
  if (!regions.length) return <Empty text="Es sind noch keine Regionen angelegt." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      {regions.map((r, i) => (
        <section key={r.id} className="panel rounded-[14px] overflow-hidden anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center justify-between gap-4 px-5 md:px-6 pt-5 pb-4">
            <div>
              <p className="eyebrow">Region</p>
              <h2 className="ui-title text-[22px] mt-1">{r.name}</h2>
            </div>
            <Chip tone={r.enabled ? "ok" : "done"} strong={r.enabled}>{r.enabled ? "Offen" : "Geschlossen"}</Chip>
          </div>
          <div className="mx-5 md:mx-6 mb-2 px-4 rounded-[10px] bg-paper-2">
            <FlagSwitch regionId={r.id} flagKey="__region" checked={r.enabled} label={<span className="font-semibold">Region offen</span>}
              hint="Neue Mitglieder mit Postleitzahl aus dieser Region können beitreten." />
          </div>
          <div className="divide-y divide-line px-5 md:px-6 pb-2">
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
      <form action="/moderation" method="get" role="search" className="flex items-center gap-2">
        <input type="hidden" name="ansicht" value="konten" />
        <label className="sr-only" htmlFor="mod-q">Vorname oder E-Mail</label>
        <div className="relative flex-1">
          <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input id="mod-q" name="q" defaultValue={q} placeholder="Vorname oder E-Mail" autoComplete="off" className="pl-11 rounded-full" />
        </div>
        <Button type="submit" className="h-12">Suchen</Button>
      </form>
      <p className="eyebrow mt-8 mb-3">{q ? `${users.length} Treffer für «${q}»` : "Neueste Konten"}</p>
      {users.length ? (
        <ul className="panel rounded-[14px] divide-y divide-line overflow-hidden">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/moderation/konto/${u.id}`} className="group flex items-center gap-4 px-4 md:px-5 py-3.5 hover:bg-paper-2 transition-colors">
                <span className="h-10 w-10 flex-none rounded-full bg-paper-3 grid place-items-center font-serif text-[19px]">{(u.first_name || "?").slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{u.first_name || "Ohne Namen"}</span>
                  <span className="block text-sm text-muted truncate">{u.email}{u.municipality ? ` · ${u.municipality}` : ""}</span>
                </span>
                {u.banned_at && <Chip tone="late" strong className="shrink-0">Gesperrt</Chip>}
                <IconArrowRight width={16} height={16} className="text-muted shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={`Kein Konto passt zu «${q}».`} action={<LinkButton href="/moderation?ansicht=konten" variant="ghost" size="sm">Suche leeren</LinkButton>} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Protokoll */
async function Log() {
  const log = await moderation.moderationLog(100);
  if (!log.length) return <Empty text="Noch keine Eingriffe protokolliert. Jeder Entscheid, jede Sperre und jeder Schalter erscheint hier." />;
  const [links, flagRows] = await Promise.all([
    targetLinks(log as unknown as { target_type: string; target_id: string }[]),
    moderation.flags(),
  ]);
  const regionNames = Object.fromEntries(flagRows.map((f) => [f.region_id, f.region_name]));
  return (
    <ol className="panel rounded-[14px] divide-y divide-line">
      {log.map((e) => {
        const href = links[`${e.target_type}:${e.target_id}`];
        const target = e.target_type === "flag" ? flagTarget(String(e.target_id), regionNames) : targetTypeLabel[e.target_type as string] ?? e.target_type;
        return (
          <li key={e.id as string} className="grid gap-x-6 gap-y-1 px-5 py-3.5 text-[15px] sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:items-baseline">
            <span className="text-[13px] text-muted tnum">{fmtDayTime(e.created_at as Date)}</span>
            <span className="min-w-0">
              <span className="font-semibold">{actionLabel[e.action as string] ?? e.action}</span>
              <span className="text-ink-2"> · {href ? <Link href={href} className="underline underline-offset-4 hover:text-ink">{target}</Link> : target}</span>
              {e.note && <span className="block text-sm text-ink-2 mt-0.5">{e.note}</span>}
            </span>
            <span className="text-[13px] text-muted">{e.moderator}</span>
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
