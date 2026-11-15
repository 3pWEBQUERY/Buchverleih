"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { AreaCanton, AreaCommune, AreaLevel, AreaRule, AreasOverview } from "@/lib/areas";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { IconSearch, IconClose } from "@/components/icons";
import { RollingNumber } from "@/components/motion";
import { cx } from "@/components/ui";
import { MOD } from "@/lib/i18n/messages/moderation";

/**
 * Freigabe nach Gebiet: alle Kantone, Bezirke und Gemeinden der Schweiz.
 * Jede Ebene hat drei Zustände – offen, zu oder «wie oben» (erbt). Die genaueste Regel gilt.
 * Änderungen sind sofort wirksam und lassen sich per «Rückgängig» zurücknehmen (keine Rückfrage).
 */
type Rules = Record<string, AreaRule>; // Schlüssel «level:code»
type Filter = "all" | "open" | "partial" | "closed" | "waitlist";
const key = (level: AreaLevel, code: string | number) => `${level}:${code}`;
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function AreaManager({ data, admin }: { data: AreasOverview; admin: boolean }) {
  const l = useLocale();
  const t = MOD[l].areas;
  const toast = useToast();
  const router = useRouter();
  const [rules, setRules] = useState<Rules>(() => {
    const r: Rules = {};
    for (const k of data.cantons) {
      r[key("canton", k.code)] = k.rule;
      for (const d of k.districts) r[key("district", d.id)] = d.rule;
      for (const c of k.communes) r[key("commune", c.bfs)] = c.rule;
    }
    return r;
  });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openCanton, setOpenCanton] = useState<string | null>(null);
  const [openDistrict, setOpenDistrict] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /** Wirksamer Zustand einer Gemeinde aus den aktuellen Regeln */
  const isOpen = (k: AreaCanton, c: AreaCommune) =>
    rules[key("commune", c.bfs)] ?? (c.district != null ? rules[key("district", c.district)] : null) ?? rules[key("canton", k.code)] ?? false;

  const view = useMemo(() => data.cantons.map((k) => {
    const open = k.communes.filter((c) => isOpen(k, c)).length;
    const status: "open" | "partial" | "closed" = open === 0 ? "closed" : open === k.communes.length ? "open" : "partial";
    const exceptions = k.districts.filter((d) => rules[key("district", d.id)] != null).length + k.communes.filter((c) => rules[key("commune", c.bfs)] != null).length;
    return { k, open, status, exceptions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, rules]);

  const totals = useMemo(() => {
    const all = view.flatMap((v) => v.k.communes.map((c) => ({ c, open: isOpen(v.k, c) })));
    return {
      communesOpen: all.filter((x) => x.open).length,
      plzOpen: all.filter((x) => x.open).reduce((n, x) => n + x.c.plz.length, 0),
      cantonsOpen: view.filter((v) => v.status === "open").length,
      cantonsPartial: view.filter((v) => v.status === "partial").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** Regeln, die eine Änderung betrifft: das Gebiet selbst und mit clearBelow alle Untergebiete */
  function affected(level: AreaLevel, code: string, clearBelow?: boolean): string[] {
    const keys = [key(level, code)];
    if (!clearBelow) return keys;
    for (const x of data.cantons) {
      if (level === "canton" && x.code !== code) continue;
      if (level === "canton") for (const d of x.districts) keys.push(key("district", d.id));
      for (const c of x.communes) if (level === "canton" || String(c.district) === code) keys.push(key("commune", c.bfs));
    }
    return keys;
  }

  async function set(level: AreaLevel, code: string, name: string, enabled: AreaRule, opts: { clearBelow?: boolean } = {}) {
    const k = key(level, code);
    const keys = affected(level, code, opts.clearBelow);
    const before = Object.fromEntries(keys.map((x) => [x, rules[x] ?? null])) as Rules;
    setBusy(k);
    setRules((r) => ({ ...r, ...Object.fromEntries(keys.map((x) => [x, x === k ? enabled : null])) }));
    try {
      await api("/mod", { body: { action: "area", level, code, enabled, clearBelow: opts.clearBelow ?? false } });
      const text = opts.clearBelow ? t.done.cleared(name) : enabled === null ? t.done.inherit(name) : enabled ? t.done.open(name) : t.done.closed(name);
      toast.show({ text, undo: () => restore(before) });
      router.refresh();
    } catch (e) {
      setRules((r) => ({ ...r, ...before }));
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Rückgängig: jede betroffene Regel auf ihren vorherigen Wert setzen */
  async function restore(before: Rules) {
    setRules((r) => ({ ...r, ...before }));
    try {
      for (const [k, v] of Object.entries(before)) {
        const [level, code] = k.split(":") as [AreaLevel, string];
        await api("/mod", { body: { action: "area", level, code, enabled: v } });
      }
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const query = norm(q.trim());
  const searching = query.length >= 2;
  const results = useMemo(() => {
    if (!searching) return [];
    const out: { level: AreaLevel; k: AreaCanton; d?: { id: number; name: string }; c?: AreaCommune; label: string }[] = [];
    for (const k of data.cantons) {
      if (norm(k.name).includes(query) || norm(k.code) === query) out.push({ level: "canton", k, label: k.name });
      for (const d of k.districts) if (norm(d.name).includes(query)) out.push({ level: "district", k, d, label: d.name });
      for (const c of k.communes) if (norm(c.name).includes(query) || c.plz.some((p) => p.startsWith(query))) out.push({ level: "commune", k, c, label: c.name });
    }
    return out;
  }, [data, query, searching]);

  const shown = view.filter((v) => filter === "all" || (filter === "waitlist" ? v.k.waitlist > 0 : v.status === filter));
  const counts = { all: view.length, open: view.filter((v) => v.status === "open").length, partial: view.filter((v) => v.status === "partial").length, closed: view.filter((v) => v.status === "closed").length, waitlist: view.filter((v) => v.k.waitlist > 0).length };

  return (
    <section aria-labelledby="gebiete-t">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-2xl">
          <h2 id="gebiete-t" className="text-title font-title tracking-title">{t.title}</h2>
          <p className="text-body text-muted mt-1.5">{t.desc}</p>
        </div>
        {!admin && <p className="text-body-sm text-ink-2 rounded-sm bg-paper-2 px-3 py-2">{t.adminOnly}</p>}
      </header>

      {/* Kennzahlen: was gerade offen ist */}
      <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi n={totals.communesOpen} of={data.totals.communes} label={t.kpi.communes} bar />
        <Kpi n={totals.plzOpen} of={data.totals.plz} label={t.kpi.plz} />
        <Kpi n={totals.cantonsOpen} label={t.kpi.cantons} extra={totals.cantonsPartial ? `+ ${totals.cantonsPartial} ${t.kpi.partial}` : undefined} />
        <Kpi n={data.totals.waitlist} label={t.kpi.waitlist} extra={`${data.totals.members} ${t.kpi.members}`} />
      </dl>

      {/* Suche und Filter */}
      <div className="mt-6 flex flex-col lg:flex-row gap-3 lg:items-center">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">{t.searchLabel}</span>
          <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"><IconSearch width={18} height={18} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} autoComplete="off"
            className="w-full h-12 bg-paper border border-field rounded-sm pl-11 pr-11 text-body-lg placeholder:text-muted hover:border-ink-2 focus:outline-none focus:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/10 [&::-webkit-search-cancel-button]:appearance-none" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t.clearSearch} className="press absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-sm text-muted hover:text-ink hover:bg-paper-2">
              <IconClose width={16} height={16} />
            </button>
          )}
        </label>
        {!searching && (
          <div role="radiogroup" aria-label={t.filterLabel} className="flex gap-1 p-1 rounded-md bg-paper-2 border border-line overflow-x-auto [scrollbar-width:none] scroll-x-fade">
            {(["all", "open", "partial", "closed", "waitlist"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
                className={cx("h-9 px-3 rounded-sm text-body-sm font-medium whitespace-nowrap inline-flex items-center gap-2 transition-colors",
                  filter === f ? "bg-paper text-ink outline outline-1 outline-line-strong" : "text-ink-2 hover:text-ink")}>
                {t.filters[f]} <span className="text-caption text-muted tnum">{counts[f]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suchergebnisse: flach, mit Pfad */}
      {searching ? (
        <div className="mt-4" aria-live="polite">
          {results.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-5 py-6 text-body text-ink-2">{t.noHits(q.trim())}</p>
          ) : (
            <>
              <p className="text-meta text-muted mb-2">{t.hits(results.length)}</p>
              <ul className="rounded-md border border-line divide-y divide-line">
                {results.slice(0, 60).map((r) => {
                  const code = r.level === "canton" ? r.k.code : r.level === "district" ? String(r.d!.id) : String(r.c!.bfs);
                  const open = r.level === "commune" ? isOpen(r.k, r.c!) : null;
                  const path = r.level === "canton" ? t.districts : [r.k.name, r.level === "commune" && r.c!.district ? r.k.districts.find((d) => d.id === r.c!.district)?.name : null].filter(Boolean).join(" · ");
                  return (
                    <li key={`${r.level}:${code}`} className="px-4 md:px-5 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                      <div className="min-w-0">
                        <p className="font-medium flex items-center gap-2">
                          {r.level === "canton" && <CantonBadge code={r.k.code} />}
                          {r.label}
                          {open !== null && <Dot open={open} />}
                        </p>
                        <p className="text-meta text-muted truncate">
                          {r.level === "canton" ? t.of(view.find((v) => v.k === r.k)!.open, r.k.total) : path}
                          {r.level === "commune" && r.c!.plz.length > 0 && <> · <span className="tnum">{r.c!.plz.slice(0, 6).join(", ")}{r.c!.plz.length > 6 ? " …" : ""}</span></>}
                        </p>
                      </div>
                      <RuleControl level={r.level} value={rules[key(r.level, code)] ?? null} name={r.label} disabled={!admin || busy === key(r.level, code)}
                        onChange={(v) => set(r.level, code, r.label, v)} />
                    </li>
                  );
                })}
              </ul>
              {results.length > 60 && <p className="text-meta text-muted mt-2">{t.moreHits(results.length - 60)}</p>}
            </>
          )}
        </div>
      ) : (
        /* Kantone: aufklappbar zu Bezirken und Gemeinden */
        <ul className="mt-4 grid gap-2">
          {shown.map(({ k, open, status, exceptions }) => {
            const expanded = openCanton === k.code;
            const pct = k.total ? open / k.total : 0;
            return (
              <li key={k.code} className={cx("rounded-md border bg-paper", expanded ? "border-line-strong" : "border-line")}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 md:px-5 py-4">
                  <button type="button" aria-expanded={expanded} aria-controls={`kt-${k.code}`} onClick={() => { setOpenCanton(expanded ? null : k.code); setOpenDistrict(null); }}
                    aria-label={expanded ? t.collapse(k.name) : t.expand(k.name)}
                    className="group flex items-center gap-4 min-w-0 flex-1 text-left min-h-11">
                    <CantonBadge code={k.code} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-lead font-medium group-hover:underline underline-offset-4">{k.name}</span>
                        <StatusChip status={status} label={t.status[status]} />
                      </span>
                      {/* Anteil offener Gemeinden als ruhiger Balken */}
                      <span className="mt-2 flex items-center gap-3">
                        <span aria-hidden className="relative h-1.5 w-full max-w-56 rounded-full bg-paper-3 overflow-hidden">
                          <span className="absolute inset-0 origin-left bg-ok transition-transform duration-base ease-out" style={{ transform: `scaleX(${pct})` }} />
                        </span>
                        <span className="text-meta text-muted tnum whitespace-nowrap">{t.of(open, k.total)}</span>
                      </span>
                    </span>
                    <svg aria-hidden viewBox="0 0 12 8" className={cx("w-3 flex-none text-muted transition-transform duration-fast", expanded && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1.5l5 5 5-5" /></svg>
                  </button>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted">
                    {k.members > 0 && <span className="tnum">{t.members(k.members)}</span>}
                    {k.waitlist > 0 && <span className="tnum inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait" />{t.waitlist(k.waitlist)}</span>}
                  </div>
                  <RuleControl level="canton" value={rules[key("canton", k.code)] ?? null} name={k.name} disabled={!admin || busy === key("canton", k.code)}
                    onChange={(v) => set("canton", k.code, k.name, v)} />
                </div>
                {exceptions > 0 && (
                  <p className="px-4 md:px-5 -mt-2 pb-3 text-meta text-muted flex flex-wrap items-center gap-x-3">
                    <span>{t.exceptions(exceptions)}</span>
                    {admin && <button type="button" onClick={() => set("canton", k.code, k.name, rules[key("canton", k.code)] ?? null, { clearBelow: true })}
                      className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink min-h-9">{t.clearExceptions}</button>}
                  </p>
                )}
                {expanded && (
                  <div id={`kt-${k.code}`} className="border-t border-line anim-rise">
                    {k.districts.length > 0 ? (
                      <ul className="divide-y divide-line">
                        {k.districts.map((d) => {
                          const dc = k.communes.filter((c) => c.district === d.id);
                          const dOpen = dc.filter((c) => isOpen(k, c)).length;
                          const dExp = openDistrict === d.id;
                          const dRule = rules[key("district", d.id)] ?? null;
                          return (
                            <li key={d.id}>
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-4 md:pl-[76px] pr-4 md:pr-5 py-3">
                                <button type="button" aria-expanded={dExp} onClick={() => setOpenDistrict(dExp ? null : d.id)} aria-label={dExp ? t.collapse(d.name) : t.expand(d.name)}
                                  className="group flex items-center gap-3 min-w-0 flex-1 text-left min-h-11">
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-medium group-hover:underline underline-offset-4">{d.name}</span>
                                    <span className="block text-meta text-muted tnum">
                                      {t.of(dOpen, dc.length)} · {dRule === null ? t.inheritCanton : t.own}
                                      {d.waitlist > 0 && <> · {t.waitlist(d.waitlist)}</>}
                                    </span>
                                  </span>
                                  <svg aria-hidden viewBox="0 0 12 8" className={cx("w-3 flex-none text-muted transition-transform duration-fast", dExp && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1.5l5 5 5-5" /></svg>
                                </button>
                                <RuleControl level="district" value={dRule} name={d.name} disabled={!admin || busy === key("district", d.id)}
                                  onChange={(v) => set("district", String(d.id), d.name, v)} />
                              </div>
                              {dExp && <CommuneList k={k} communes={dc} rules={rules} isOpen={isOpen} admin={admin} busy={busy}
                                inheritLabel={t.inheritDistrict} onSet={(c, v) => set("commune", String(c.bfs), c.name, v)} />}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <CommuneList k={k} communes={k.communes} rules={rules} isOpen={isOpen} admin={admin} busy={busy}
                        inheritLabel={t.inheritCanton} onSet={(c, v) => set("commune", String(c.bfs), c.name, v)} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-meta text-muted mt-4">{t.source}</p>
    </section>
  );
}

function CommuneList({ k, communes, rules, isOpen, admin, busy, inheritLabel, onSet }: {
  k: AreaCanton; communes: AreaCommune[]; rules: Rules; isOpen: (k: AreaCanton, c: AreaCommune) => boolean; admin: boolean; busy: string | null;
  inheritLabel: string; onSet: (c: AreaCommune, v: AreaRule) => void;
}) {
  const t = MOD[useLocale()].areas;
  return (
    <ul className="bg-paper-2/60 border-t border-line divide-y divide-line">
      {communes.map((c) => {
        const r = rules[key("commune", c.bfs)] ?? null;
        const open = isOpen(k, c);
        return (
          <li key={c.bfs} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pl-4 md:pl-[100px] pr-4 md:pr-5 py-2.5">
            <div className="min-w-0">
              <p className="text-body flex items-center gap-2">{c.name}<Dot open={open} /></p>
              <p className="text-meta text-muted tnum truncate">
                {c.plz.length ? `${t.plz} ${c.plz.slice(0, 5).join(", ")}${c.plz.length > 5 ? " …" : ""}` : "–"}
                {" · "}{r === null ? inheritLabel : t.own}
                {c.members > 0 && <> · {t.members(c.members)}</>}
                {c.waitlist > 0 && <> · {t.waitlist(c.waitlist)}</>}
              </p>
            </div>
            <RuleControl level="commune" value={r} name={c.name} disabled={!admin || busy === key("commune", c.bfs)} onChange={(v) => onSet(c, v)} size="sm" />
          </li>
        );
      })}
    </ul>
  );
}

/** Dreistufiger Schalter: Offen · Wie oben · Zu (Kantone kennen kein «Wie oben»: ohne Regel sind sie zu) */
function RuleControl({ level, value, name, disabled, onChange, size = "md" }: { level: AreaLevel; value: AreaRule; name: string; disabled?: boolean; onChange: (v: AreaRule) => void; size?: "sm" | "md" }) {
  const t = MOD[useLocale()].areas;
  const opts: { v: AreaRule; label: string }[] = level === "canton"
    ? [{ v: true, label: t.rule.open }, { v: false, label: t.rule.closed }]
    : [{ v: true, label: t.rule.open }, { v: null, label: t.rule.inherit }, { v: false, label: t.rule.closed }];
  const current = level === "canton" ? value === true : value;
  return (
    <div role="radiogroup" aria-label={t.ruleAria(name)} className={cx("inline-flex flex-none p-0.5 rounded-md bg-paper-2 border border-line", disabled && "opacity-60")}>
      {opts.map((o) => {
        const on = level === "canton" ? (o.v === true) === current : o.v === current;
        return (
          <button key={String(o.v)} type="button" role="radio" aria-checked={on} disabled={disabled}
            onClick={() => !on && onChange(level === "canton" && o.v === false ? null : o.v)}
            className={cx("rounded-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
              size === "sm" ? "h-9 md:h-8 px-2.5 text-meta" : "h-10 md:h-9 px-3 text-body-sm",
              on ? (o.v === true ? "bg-paper text-ok outline outline-1 outline-ok/40" : o.v === false ? "bg-paper text-ink outline outline-1 outline-line-strong" : "bg-paper text-ink-2 outline outline-1 outline-line-strong")
                : "text-muted hover:text-ink")}>
            {o.v === true && on && <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ok mr-1.5 align-middle" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CantonBadge({ code }: { code: string }) {
  return <span aria-hidden className="flex-none h-10 w-10 rounded-md bg-paper-2 border border-line grid place-items-center text-meta font-semibold tracking-caps text-ink-2">{code}</span>;
}

function StatusChip({ status, label }: { status: "open" | "partial" | "closed"; label: string }) {
  return (
    <span className={cx("chip", status === "open" && "!border-ok/40 !text-ok", status === "partial" && "!border-wait/40 !text-wait")}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", status === "open" ? "bg-ok" : status === "partial" ? "bg-wait" : "bg-done")} />{label}
    </span>
  );
}

function Dot({ open }: { open: boolean }) {
  const t = MOD[useLocale()].areas;
  return (
    <span className={cx("inline-flex items-center gap-1 text-caption font-medium", open ? "text-ok" : "text-muted")}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", open ? "bg-ok" : "bg-done")} />{open ? t.status.open : t.status.closed}
    </span>
  );
}

function Kpi({ n, of, label, extra, bar }: { n: number; of?: number; label: string; extra?: ReactNode; bar?: boolean }) {
  return (
    <div className="rounded-md bg-paper-2 px-4 py-3.5 min-w-0">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="text-title font-title tracking-display leading-none tnum"><RollingNumber value={n} /></span>
        {of != null && <span className="text-body text-muted tnum"> / {of.toLocaleString("de-CH")}</span>}
        <span aria-hidden className="block text-caption text-muted mt-1.5">{label}</span>
        {bar && of ? (
          <span aria-hidden className="mt-2 block h-1 rounded-full bg-paper-3 overflow-hidden">
            <span className="block h-full origin-left bg-ok transition-transform duration-base ease-out" style={{ transform: `scaleX(${n / of})` }} />
          </span>
        ) : null}
        {extra && <span className="block text-caption text-muted mt-1">{extra}</span>}
      </dd>
    </div>
  );
}
