import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { userDossier } from "@/lib/moderation";
import { AppError } from "@/lib/errors";
import type { LoanStatus } from "@/lib/loans/machine";
import { ago, fmtDay } from "@/lib/dates";
import { reportReasonLabel, statusLabel, trustLabel } from "@/lib/i18n/de-CH";
import { Notice } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { BanControls, SuspendSwitch } from "@/components/moderation/actions";
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

  return (
    <div>
      <Link href="/moderation?ansicht=konten" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6"><IconArrowLeft /> Konten</Link>
      <header className="mb-10">
        <p className="eyebrow">{roleLabel[u.role] ?? u.role} · Stufe {trustLabel[u.trust_level] ?? u.trust_level}</p>
        <h1 className="display text-4xl md:text-6xl mt-3">{u.first_name || "Ohne Namen"}</h1>
        <p className="text-ink-2 mt-3 break-words">
          {u.email}
          {u.phone_e164 && <> · <span className="tnum">{fmtPhone(u.phone_e164)}</span></>}
          {u.municipality && <> · {u.municipality}</>}
        </p>
        <p className="text-sm text-muted mt-1">Mitglied seit {fmtDay(u.created_at)}</p>
        {(u.banned_at || u.lending_suspended_at) && (
          <p className="text-late text-[15px] mt-4">
            {u.banned_at ? `Gesperrt seit ${fmtDay(u.banned_at)}` : `Leihsperre seit ${fmtDay(u.lending_suspended_at)}`}
          </p>
        )}
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 border-y border-line py-6 mb-12">
        {numbers.map(([k, v]) => (
          <div key={k} className="pr-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-serif text-3xl tnum mt-1">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-12">
        <section aria-labelledby="massnahmen" className="lg:col-span-5 lg:order-2 min-w-0">
          <h2 id="massnahmen" className="text-xl md:text-2xl border-b border-line pb-2">Massnahmen</h2>
          {self ? (
            <Notice className="mt-4">Das ist dein eigenes Konto. Sperren und Leihsperre setzt eine andere Person aus der Moderation.</Notice>
          ) : (
            <>
              <div className="py-5 border-b border-line">
                <p className="text-sm font-medium mb-3">Kontosperre</p>
                <BanControls userId={u.id} banned={Boolean(u.banned_at)} reason={u.ban_reason} />
              </div>
              <div className="border-b border-line">
                <SuspendSwitch userId={u.id} suspended={Boolean(u.lending_suspended_at)} />
              </div>
            </>
          )}
        </section>

        <div className="lg:col-span-7 lg:order-1 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="vorgaenge">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <h2 id="vorgaenge" className="text-xl md:text-2xl">Vorgänge</h2>
              <span className="text-sm text-muted tnum">{loans.length === 50 ? "die letzten 50" : loans.length}</span>
            </div>
            {loans.length === 0 ? <p className="py-4 text-ink-2">Noch keine Vorgänge.</p> : (
              <ul className="divide-y divide-line border-b border-line">
                {loans.map((l) => (
                  <li key={l.id}>
                    <Link href={`/moderation/vorgang/${l.id}`} className="group flex items-baseline justify-between gap-6 py-3 -mx-2 px-2 hover:bg-paper-2 rounded-xs">
                      <span className="min-w-0">
                        <span className="block font-serif text-[17px] leading-snug group-hover:underline truncate">{l.title}</span>
                        <span className="block text-sm text-muted">{kindLabel[l.kind] ?? l.kind} · {l.as_owner ? "verleiht" : "leiht"} · {fmtDay(l.requested_at)}</span>
                      </span>
                      <span className={l.status === "disputed" || l.status === "lost" ? "text-sm text-late shrink-0" : "text-sm text-ink-2 shrink-0"}>
                        {statusLabel[l.status as LoanStatus] ?? l.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="meldungen">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <h2 id="meldungen" className="text-xl md:text-2xl">Meldungen zu diesem Konto</h2>
              <span className="text-sm text-muted tnum">{reports.length}</span>
            </div>
            {reports.length === 0 ? <p className="py-4 text-ink-2">Keine Meldungen.</p> : (
              <ul className="divide-y divide-line border-b border-line">
                {reports.map((r) => (
                  <li key={r.id} className="py-3">
                    <p className="text-[15px] flex flex-wrap justify-between gap-x-6">
                      <span className="font-medium">{reportReasonLabel[r.reason as keyof typeof reportReasonLabel] ?? r.reason}</span>
                      <span className={r.status === "open" ? "text-sm text-late" : "text-sm text-muted"}>{reportStatusLabel[r.status] ?? r.status}</span>
                    </p>
                    {r.note && <p className="text-sm text-ink-2 mt-0.5 max-w-prose">«{r.note}»</p>}
                    <p className="text-sm text-muted mt-0.5">{ago(r.created_at)}</p>
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
