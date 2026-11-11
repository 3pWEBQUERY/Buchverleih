import Link from "next/link";
import { Monogram } from "@/components/person/monogram";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { userDossier } from "@/lib/moderation";
import { AppError } from "@/lib/errors";
import type { LoanStatus } from "@/lib/loans/machine";
import { ago, fmtDay } from "@/lib/dates";
import { reportReasonLabel, statusLabel, trustLabel } from "@/lib/i18n/de-CH";
import { Notice, cx } from "@/components/ui";
import { BackLink, Chip, ModHead, Quiet, StatTile } from "@/components/moderation/ui";
import { BanControls, RemoveAvatar, SuspendSwitch } from "@/components/moderation/actions";
import { kindLabel } from "../../labels";

export const metadata = { title: "Konto · Moderation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roleLabel: Record<string, string> = { member: "Mitglied", moderator: "Moderation", admin: "Administration" };
const reportStatusLabel: Record<string, string> = { open: "Offen", actioned: "Erledigt", dismissed: "Verworfen" };

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
  const { user: u, loans, reports } = d;
  const rated = Number(u.rated_count);
  const punctual = rated > 0 ? Math.round((100 * Number(u.punctual_count)) / rated) : null;
  const responseH = u.median_response_seconds != null ? Number(u.median_response_seconds) / 3600 : null;
  const numbers: [string, string][] = [
    ["Verliehen", String(u.lent_count)],
    ["Geliehen", String(u.borrowed_count)],
    ["Pünktlich zurück", punctual === null ? "–" : `${punctual} %`],
    ["Verluste (24 Mt.)", String(u.visible_losses)],
    ["Antwortzeit", responseH === null ? "–" : responseH < 1 ? `${Math.max(1, Math.round(responseH * 60))} Min.` : `${responseH.toLocaleString("de-CH", { maximumFractionDigits: 1 })} Std.`],
  ];
  const self = u.id === mod.id;

  const initial = (u.first_name || "?").slice(0, 1).toUpperCase();

  return (
    <div>
      <BackLink href="/moderation?ansicht=konten">Konten</BackLink>
      <header className="mb-10 md:mb-12 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 anim-rise">
        <span className="md:hidden"><Monogram name={u.first_name || "?"} seed={u.id} size={64} photo={u.avatar_key} /></span><span className="hidden md:block"><Monogram name={u.first_name || "?"} seed={u.id} size={80} photo={u.avatar_key} /></span>
        <div className="min-w-0">
          <p className="eyebrow">{roleLabel[u.role] ?? u.role} · Stufe {trustLabel[u.trust_level] ?? u.trust_level}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-2">{u.first_name || "Ohne Namen"}</h1>
          <p className="text-ink-2 mt-3 break-words">
            {u.email}
            {u.phone_e164 && <> · <span className="tnum">{fmtPhone(u.phone_e164)}</span></>}
            {u.municipality && <> · {u.municipality}</>}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Chip>Mitglied seit {fmtDay(u.created_at)}</Chip>
            {u.banned_at && <Chip tone="late" strong>Gesperrt seit {fmtDay(u.banned_at)}</Chip>}
            {!u.banned_at && u.lending_suspended_at && <Chip tone="lent" strong>Leihsperre seit {fmtDay(u.lending_suspended_at)}</Chip>}
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
          <ModHead id="massnahmen" title="Massnahmen" />
          {self ? (
            <Notice>Das ist dein eigenes Konto. Sperren und Leihsperre setzt eine andere Person aus der Moderation.</Notice>
          ) : (
            <div className="rounded-[10px] border border-line divide-y divide-line">
              <div className="px-5 md:px-6">
                <SuspendSwitch userId={u.id} suspended={Boolean(u.lending_suspended_at)} />
              </div>
              {u.avatar_key && (
                <div className="px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[15px]">Profilbild</p>
                    <p className="text-[13px] text-muted mt-0.5">Unpassende Bilder entfernen. Die Person sieht danach wieder ihre Initiale.</p>
                  </div>
                  <RemoveAvatar userId={u.id} />
                </div>
              )}
              <div className="p-5 md:p-6 rounded-b-[14px] bg-late/[0.04]">
                <p className="eyebrow !text-late mb-1">Gefahrenzone</p>
                <p className="font-medium text-[16px] mb-4">Kontosperre</p>
                <BanControls userId={u.id} banned={Boolean(u.banned_at)} reason={u.ban_reason} />
              </div>
            </div>
          )}
        </section>

        <div className="lg:col-span-7 lg:order-1 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="vorgaenge">
            <ModHead id="vorgaenge" title="Vorgänge" count={loans.length} aside={loans.length === 50 ? "die letzten 50" : undefined} />
            {loans.length === 0 ? <Quiet>Noch keine Vorgänge.</Quiet> : (
              <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
                {loans.map((l) => {
                  const bad = l.status === "disputed" || l.status === "lost";
                  return (
                    <li key={l.id}>
                      <Link href={`/moderation/vorgang/${l.id}`} className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-paper-2 transition-colors">
                        <span className="min-w-0">
                          <span className="block font-serif text-[20px] leading-snug truncate">{l.title}</span>
                          <span className="block text-[13px] text-muted">{kindLabel[l.kind] ?? l.kind} · {l.as_owner ? "verleiht" : "leiht"} · {fmtDay(l.requested_at)}</span>
                        </span>
                        <Chip tone={bad ? "late" : l.status === "active" ? "lent" : "done"} strong={bad} className="shrink-0">
                          {statusLabel[l.status as LoanStatus] ?? l.status}
                        </Chip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="meldungen">
            <ModHead id="meldungen" title="Meldungen zu diesem Konto" count={reports.length} />
            {reports.length === 0 ? <Quiet>Keine Meldungen.</Quiet> : (
              <ul className="rounded-[10px] border border-line divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                      <span className="font-medium">{reportReasonLabel[r.reason as keyof typeof reportReasonLabel] ?? r.reason}</span>
                      <Chip tone={r.status === "open" ? "late" : "done"} strong={r.status === "open"}>{reportStatusLabel[r.status] ?? r.status}</Chip>
                    </div>
                    {r.note && <p className="text-sm text-ink-2 mt-1.5 max-w-prose">«{r.note}»</p>}
                    <p className="text-[13px] text-muted mt-1">{ago(r.created_at)}</p>
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
