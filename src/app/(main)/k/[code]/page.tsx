import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { circleByInvite } from "@/lib/circles";
import { LinkButton } from "@/components/ui";
import { Spine } from "@/components/spine";
import { JoinButton } from "./join-button";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export async function generateMetadata() {
  return { title: CIRCLES[await getLocale()].invite.title, robots: { index: false } };
}

/** Öffentliche Einladungsseite eines Kreises (PRD 7.5) */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [user, circle] = await Promise.all([getUser(), circleByInvite(code)]);
  const c = CIRCLES[await getLocale()];
  const t = c.invite;

  if (!circle) {
    return (
      <div className="min-h-[60vh] grid place-items-center py-6">
        <div className="w-full max-w-xl panel-quiet !rounded-[12px] p-8 md:p-12 text-center anim-rise">
          <div aria-hidden className="flex items-end justify-center gap-1 h-[88px] opacity-60">
            <Spine title="Stiller" author="Max Frisch" height={88} />
            <Spine title="Der Process" author="Franz Kafka" height={88} />
            <Spine title="Homo faber" author="Max Frisch" height={88} />
          </div>
          <p className="eyebrow mt-8">{t.title}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-3">{t.invalidHeading[0]}<em>{t.invalidHeading[1]}</em></h1>
          <p className="text-ink-2 text-[16px] mt-5 max-w-sm mx-auto">{t.invalidText}</p>
          <LinkButton href="/" className="mt-8">{t.home}</LinkButton>
        </div>
      </div>
    );
  }

  const [membership] = user
    ? await sql<{ status: "active" | "pending" }[]>`select status from circle_members where circle_id = ${circle.id} and user_id = ${user.id}`
    : [];
  const next = `/k/${code}`;

  return (
    <div className="min-h-[70vh] grid place-items-center py-2 md:py-8">
      <div className="w-full max-w-xl anim-rise">
        {/* Oben die dunkle Bühne mit einem Brett voller Buchrücken (Dekor), unten die Handlung */}
        <div className="surface-night rounded-t-[22px] px-6 md:px-10 pt-8 md:pt-10 pb-8 md:pb-10 text-center">
          <div aria-hidden className="flex items-end justify-center gap-[3px] h-[112px] overflow-hidden">
            {DECOR.map(([t, a], i) => (
              <span key={t} className="anim-rise" style={{ animationDelay: `${120 + i * 40}ms` }}><Spine title={t} author={a} height={112} /></span>
            ))}
          </div>
          <div aria-hidden className="h-[3px] bg-night-ink/90 rounded-full max-w-[420px] mx-auto" />
          <p className="text-[12px] font-medium text-night-muted mt-8">{t.eyebrow}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-3 break-words">{circle.name}</h1>
          {circle.description && <p className="text-[17px] text-night-ink/85 mt-5 leading-relaxed max-w-md mx-auto">{circle.description}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-2 tnum">
            <span className="h-7 px-3 rounded-[6px] bg-night-2 text-[13px] font-medium inline-flex items-center">{circle.member_count} {c.members(circle.member_count)}</span>
            <span className="h-7 px-3 rounded-[6px] bg-night-2 text-[13px] font-medium inline-flex items-center">{circle.join_mode === "link" ? t.joinNow : c.joinApproval}</span>
          </div>
        </div>

        <div className="panel !rounded-t-none !rounded-b-[22px] !border-t-0 px-6 md:px-10 py-7 md:py-8 text-center">
          {membership?.status === "active" ? (
            <>
              <p className="text-ink-2 mb-5">{t.already}</p>
              <LinkButton href={`/kreise/${circle.id}`} variant="primary" size="lg">{t.toCircle}</LinkButton>
            </>
          ) : membership?.status === "pending" ? (
            <p className="text-ink-2 flex items-center justify-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" /> {t.sent}</p>
          ) : !user ? (
            <>
              <p className="text-ink-2 mb-6 max-w-sm mx-auto">{t.loginText}</p>
              <LinkButton href={`/anmelden?next=${encodeURIComponent(next)}`} variant="primary" size="lg" className="w-full sm:w-auto">{t.loginJoin}</LinkButton>
            </>
          ) : !user.onboarded_at ? (
            <>
              <p className="text-ink-2 mb-6 max-w-sm mx-auto">{t.profileText}</p>
              <LinkButton href={`/willkommen?next=${encodeURIComponent(next)}`} variant="primary" size="lg" className="w-full sm:w-auto">{t.profile}</LinkButton>
            </>
          ) : (
            <JoinButton code={code} circleId={circle.id} approval={circle.join_mode === "approval"} />
          )}
        </div>
      </div>
    </div>
  );
}

const DECOR: [string, string][] = [
  ["Stiller", "Max Frisch"], ["Effi Briest", "Theodor Fontane"], ["Der Process", "Franz Kafka"], ["Heidi", "Johanna Spyri"],
  ["Siddhartha", "Hermann Hesse"], ["Homo faber", "Max Frisch"], ["Buddenbrooks", "Thomas Mann"],
];
