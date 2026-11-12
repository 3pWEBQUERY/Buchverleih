import Link from "next/link";
import { Monogram } from "@/components/person/monogram";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { userDossier } from "@/lib/moderation";
import { AppError } from "@/lib/errors";
import type { LoanStatus } from "@/lib/loans/machine";
import { ago, fmtDay } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import { getLocale } from "@/lib/i18n/server";
import { MOD } from "@/lib/i18n/messages/moderation";
import { Notice, cx } from "@/components/ui";
import { BackLink, Chip, ModHead, Quiet, StatTile } from "@/components/moderation/ui";
import { BanControls, RemoveAvatar, RoleControl, SuspendSwitch, TempPasswordControl } from "@/components/moderation/actions";
import { modLabels } from "../../labels";

export async function generateMetadata() {
  return { title: MOD[await getLocale()].accountTitle };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtPhone(p: string) {
  const m = /^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = await pageUser(`/moderation/konto/${id}`);
  if (mod.role === "member" || !UUID.test(id)) notFound();
  const d = await userDossier(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) return null;
    throw e;
  });
  if (!d) notFound();
  const l = await getLocale();
  const t = MOD[l].account;
  const ml = modLabels(l);
  const L = labels(l);
  const { user: u, loans, reports } = d;
  const rated = Number(u.rated_count);
  const punctual = rated > 0 ? Math.round((100 * Number(u.punctual_count)) / rated) : null;
  const responseH = u.median_response_seconds != null ? Number(u.median_response_seconds) / 3600 : null;
  const numbers: [string, string][] = [
    [t.numbers.lent, String(u.lent_count)],
    [t.numbers.borrowed, String(u.borrowed_count)],
    [t.numbers.punctual, punctual === null ? "–" : `${punctual} %`],
    [t.numbers.losses, String(u.visible_losses)],
    [t.numbers.response, responseH === null ? "–" : responseH < 1 ? `${Math.max(1, Math.round(responseH * 60))}${t.min}` : `${responseH.toLocaleString("de-CH", { maximumFractionDigits: 1 }).replace(".", ",")}${t.hours}`],
  ];
  const self = u.id === mod.id;

  const initial = (u.first_name || "?").slice(0, 1).toUpperCase();

  return (
    <div>
      <BackLink href="/moderation?ansicht=konten">{t.back}</BackLink>
      <header className="mb-10 md:mb-12 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 anim-rise">
        <span className="md:hidden"><Monogram name={u.first_name || "?"} seed={u.id} size={64} photo={u.avatar_key} /></span><span className="hidden md:block"><Monogram name={u.first_name || "?"} seed={u.id} size={80} photo={u.avatar_key} /></span>
        <div className="min-w-0">
          <p className="eyebrow">{ml.role[u.role] ?? u.role} · {t.level} {L.trustLabel[u.trust_level] ?? u.trust_level}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-2">{u.first_name || MOD[l].accounts.noName}</h1>
          <p className="text-ink-2 mt-3 break-words">
            {u.email}
            {u.phone_e164 && <> · <span className="tnum">{fmtPhone(u.phone_e164)}</span></>}
            {u.municipality && <> · {u.municipality}</>}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Chip>{t.memberSince(fmtDay(u.created_at, l))}</Chip>
            {u.banned_at && <Chip tone="late" strong>{t.bannedSince(fmtDay(u.banned_at, l))}</Chip>}
            {!u.banned_at && u.lending_suspended_at && <Chip tone="lent" strong>{t.suspendedSince(fmtDay(u.lending_suspended_at, l))}</Chip>}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12 md:mb-14">
        {numbers.map(([k, v], i) => (
          <StatTile key={k} label={k} value={v} className={cx("anim-rise", i === 3 && Number(u.visible_losses) > 0 && "!bg-late/10 text-late")} />
        ))}
      </dl>

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <section aria-labelledby="massnahmen" className="lg:col-span-5 lg:order-2 min-w-0">
          <ModHead id="massnahmen" title={t.measures} />
          {self ? (
            <Notice>{t.self}</Notice>
          ) : (
            <div className="rounded-[10px] border border-line divide-y divide-line">
              {mod.role === "admin" && u.role !== "admin" && (
                <div className="px-5 md:px-6 py-4">
                  <RoleControl userId={u.id} role={u.role} name={u.first_name || t.thisPerson} />
                </div>
              )}
              {mod.role === "admin" && (
                <div className="px-5 md:px-6 py-4">
                  <TempPasswordControl userId={u.id} />
                </div>
              )}
              <div className="px-5 md:px-6">
                <SuspendSwitch userId={u.id} suspended={Boolean(u.lending_suspended_at)} />
              </div>
              {u.avatar_key && (
                <div className="px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[15px]">{t.avatar}</p>
                    <p className="text-[13px] text-muted mt-0.5">{t.avatarText}</p>
                  </div>
                  <RemoveAvatar userId={u.id} />
                </div>
              )}
              <div className="p-5 md:p-6 rounded-b-[14px] bg-late/[0.04]">
                <p className="eyebrow !text-late mb-1">{t.danger}</p>
                <p className="font-medium text-[16px] mb-4">{t.ban}</p>
                <BanControls userId={u.id} banned={Boolean(u.banned_at)} reason={u.ban_reason} />
              </div>
            </div>
          )}
        </section>

        <div className="lg:col-span-7 lg:order-1 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="vorgaenge">
            <ModHead id="vorgaenge" title={t.loans} count={loans.length} aside={loans.length === 50 ? t.last50 : undefined} />
            {loans.length === 0 ? <Quiet>{t.noLoans}</Quiet> : (
              <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
                {loans.map((x) => {
                  const bad = x.status === "disputed" || x.status === "lost";
                  return (
                    <li key={x.id}>
                      <Link href={`/moderation/vorgang/${x.id}`} className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-paper-2 transition-colors">
                        <span className="min-w-0">
                          <span className="block font-serif text-[20px] leading-snug truncate">{x.title}</span>
                          <span className="block text-[13px] text-muted">{ml.kind[x.kind] ?? x.kind} · {x.as_owner ? t.lends : t.borrows} · {fmtDay(x.requested_at, l)}</span>
                        </span>
                        <Chip tone={bad ? "late" : x.status === "active" ? "lent" : "done"} strong={bad} className="shrink-0">
                          {L.statusLabel[x.status as LoanStatus] ?? x.status}
                        </Chip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="meldungen">
            <ModHead id="meldungen" title={t.reports} count={reports.length} />
            {reports.length === 0 ? <Quiet>{t.noReports}</Quiet> : (
              <ul className="rounded-[10px] border border-line divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                      <span className="font-medium">{L.reportReasonLabel[r.reason as keyof typeof L.reportReasonLabel] ?? r.reason}</span>
                      <Chip tone={r.status === "open" ? "late" : "done"} strong={r.status === "open"}>{ml.reportStatus[r.status] ?? r.status}</Chip>
                    </div>
                    {r.note && <p className="text-sm text-ink-2 mt-1.5 max-w-prose">«{r.note}»</p>}
                    <p className="text-[13px] text-muted mt-1">{ago(r.created_at, l)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
