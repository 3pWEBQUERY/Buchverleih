import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { circleByInvite } from "@/lib/circles";
import { LinkButton } from "@/components/ui";
import { JoinButton } from "./join-button";

export const metadata = { title: "Einladung", robots: { index: false } };

/** Öffentliche Einladungsseite eines Kreises (PRD 7.5) */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [user, circle] = await Promise.all([getUser(), circleByInvite(code)]);

  if (!circle) {
    return (
      <div className="max-w-xl py-6 md:py-10">
        <p className="eyebrow">Einladung</p>
        <h1 className="display text-4xl md:text-6xl mt-3">Dieser Link gilt nicht mehr.</h1>
        <p className="text-ink-2 mt-6">Vielleicht wurde er erneuert. Frag die Person, die dich eingeladen hat, nach dem aktuellen Link.</p>
        <LinkButton href="/" className="mt-8">Zur Startseite</LinkButton>
      </div>
    );
  }

  const [membership] = user
    ? await sql<{ status: "active" | "pending" }[]>`select status from circle_members where circle_id = ${circle.id} and user_id = ${user.id}`
    : [];
  const next = `/k/${code}`;

  return (
    <div className="max-w-xl py-6 md:py-10">
      <p className="eyebrow">Einladung in einen Kreis</p>
      <h1 className="display text-4xl md:text-6xl mt-3">{circle.name}</h1>
      {circle.description && <p className="text-lg text-ink-2 mt-5 leading-relaxed">{circle.description}</p>}
      <p className="text-[15px] text-muted mt-5 tnum">
        {circle.member_count} {circle.member_count === 1 ? "Mitglied" : "Mitglieder"} · {circle.join_mode === "link" ? "Beitritt sofort" : "Beitritt mit Freigabe durch die Admins"}
      </p>

      <div className="mt-10 pt-8 border-t border-line">
        {membership?.status === "active" ? (
          <>
            <p className="text-ink-2 mb-5">Du bist bereits Mitglied.</p>
            <LinkButton href={`/kreise/${circle.id}`} variant="primary" size="lg">Zum Kreis</LinkButton>
          </>
        ) : membership?.status === "pending" ? (
          <p className="text-ink-2">Deine Anfrage ist gesendet. Sobald ein Admin dich freigibt, erhältst du eine Nachricht.</p>
        ) : !user ? (
          <>
            <p className="text-ink-2 mb-5">Ein Kreis teilt ein gemeinsames Regal. Melde dich an, um beizutreten. Ohne Konto dauert es eine Minute, ohne Passwort.</p>
            <LinkButton href={`/anmelden?next=${encodeURIComponent(next)}`} variant="primary" size="lg">Anmelden und beitreten</LinkButton>
          </>
        ) : !user.onboarded_at ? (
          <>
            <p className="text-ink-2 mb-5">Vervollständige zuerst dein Profil. Danach geht es hier weiter.</p>
            <LinkButton href={`/willkommen?next=${encodeURIComponent(next)}`} variant="primary" size="lg">Profil vervollständigen</LinkButton>
          </>
        ) : (
          <JoinButton code={code} circleId={circle.id} approval={circle.join_mode === "approval"} />
        )}
      </div>
    </div>
  );
}
