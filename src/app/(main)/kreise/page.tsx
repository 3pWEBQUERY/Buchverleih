import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myCircles } from "@/lib/circles";
import { circlePreviews } from "@/lib/kreise-queries";
import { LinkButton, cx } from "@/components/ui";
import { Cover } from "@/components/cover";
import { Faces } from "@/components/kreise/faces";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconPlus } from "@/components/icons";

export const metadata = { title: "Kreise" };

const STEPS = [
  ["Gründen", "Name, Leihfrist und Übergabeort festlegen. Du wirst Admin."],
  ["Einladen", "Den Link an Nachbarn, Lesegruppe oder Team schicken."],
  ["Bücher freigeben", "Im Regal wählen, welche Bücher im Kreis stehen."],
] as const;

/** Meine Kreise (PRD 7.5): geschlossene Gruppen mit gemeinsamem Regal. */
export default async function Page() {
  const user = await pageUser("/kreise");
  const circles = await myCircles(user.id);
  const previews = await circlePreviews(circles.map((c) => c.id));
  const active = circles.filter((c) => c.my_status !== "pending");
  const books = active.reduce((n, c) => n + c.copy_count, 0);
  const people = active.reduce((n, c) => n + c.member_count, 0);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Gemeinsame Regale</p>
          <h1 className="display text-[32px] md:text-[44px] mt-2">Deine Kreise. <em>Bücher unter Bekannten.</em></h1>
          <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-xl">
            Ein Kreis ist eine geschlossene Gruppe mit gemeinsamem Regal: Nachbarschaft, Lesegruppe, Team. Leihen im Kreis zählen nicht gegen deine Limite.
          </p>
        </div>
        {circles.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={active.length} label={active.length === 1 ? "Kreis" : "Kreise"} />
            <StatTile n={people} label="Mitglieder" />
            <StatTile n={books} label="Bücher" />
          </dl>
        )}
      </header>

      {circles.length === 0 ? (
        <div className="mt-10">
          <StepSection n={1} first title="So funktioniert ein Kreis" desc="In drei Schritten zum gemeinsamen Regal. Alles lässt sich später ändern.">
            <ol className="grid sm:grid-cols-3 gap-3">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="rounded-[10px] border border-line p-5">
                  <span className="text-[13px] tnum text-accent-hover font-medium">0{i + 1}</span>
                  <p className="font-medium text-[16px] mt-3">{t}</p>
                  <p className="text-[13.5px] text-muted mt-1 leading-snug">{d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <LinkButton href="/kreise/neu" variant="primary" size="lg"><IconPlus width={18} height={18} /> Kreis gründen</LinkButton>
              <p className="text-[14px] text-muted">Hast du einen Einladungslink? Öffne ihn einfach, dann trittst du bei.</p>
            </div>
          </StepSection>
        </div>
      ) : (
        <div className="mt-10">
          <StepSection n={1} first title="Deine Kreise" aside={`${circles.length} ${circles.length === 1 ? "Kreis" : "Kreise"}`}
            desc="Ein Tippen öffnet das gemeinsame Regal, die Mitglieder und den Einladungslink.">
            <ul className="grid xl:grid-cols-2 gap-3">
              {circles.map((c, i) => {
                const pending = c.my_status === "pending";
                const p = previews[c.id] ?? { names: [], books: [] };
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-muted flex items-center gap-1.5">
                          {pending && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" />}
                          {pending ? "Anfrage gesendet" : c.my_role === "admin" ? "Du bist Admin" : "Mitglied"}
                        </p>
                        <h2 className="text-[26px] md:text-[30px] font-[560] tracking-[-0.035em] leading-[1.05] mt-1.5 break-words">{c.name}</h2>
                        {c.description && <p className="text-ink-2 text-[14.5px] mt-2 line-clamp-2 max-w-md">{c.description}</p>}
                      </div>
                      {!pending && (
                        <span aria-hidden className="h-10 w-10 flex-none rounded-[6px] bg-accent-soft text-accent-hover grid place-items-center transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                          <IconArrowRight width={17} height={17} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </div>

                    {/* Die neuesten Bücher des Kreises als Cover-Reihe auf einem Brett */}
                    <div aria-hidden className="mt-5 rounded-[8px] bg-paper-2 px-4 pt-4 relative overflow-hidden">
                      {p.books.length > 0 ? (
                        <div className="flex items-end gap-2 h-[84px]">
                          {p.books.map((b) => (
                            <Cover key={b.id} width={50} height={75} uniform
                              data={{ title: b.title, authors: b.authors, coverKey: b.cover_key, photoKey: b.photo_key, photoW: b.photo_w, photoH: b.photo_h, seed: b.work_id }} />
                          ))}
                        </div>
                      ) : (
                        <p className="h-[84px] flex items-center text-[13.5px] text-muted">Noch keine Bücher im Kreis.</p>
                      )}
                      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-line-strong" />
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                      {pending ? (
                        <p className="text-[13.5px] text-muted max-w-xs">Deine Beitrittsanfrage wartet auf die Freigabe durch die Admins.</p>
                      ) : (
                        <Faces names={p.names.map((n) => n.name)} seeds={p.names.map((n) => n.id)} photos={p.names.map((n) => n.photo)} total={c.member_count} size={30} />
                      )}
                      <dl className="flex gap-1.5 text-[13px]">
                        {([[c.copy_count, c.copy_count === 1 ? "Buch" : "Bücher"], [`${c.loan_days} Tage`, "Leihfrist"]] as [number | string, string][]).map(([n, l]) => (
                          <div key={l} className="rounded-[6px] bg-paper-2 px-2.5 py-1.5 flex items-baseline gap-1.5">
                            <dt className="sr-only">{l}</dt>
                            <dd className="font-[560] tnum">{n}</dd>
                            <span aria-hidden className="text-muted">{l}</span>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </>
                );
                return (
                  <li key={c.id} className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                    {pending ? (
                      <div className="rounded-[10px] border border-dashed border-line-strong p-5 md:p-6 h-full">{body}</div>
                    ) : (
                      <Link href={`/kreise/${c.id}`} className={cx("group rounded-[10px] border border-line p-5 md:p-6 h-full block hover:border-accent transition-colors")}>{body}</Link>
                    )}
                  </li>
                );
              })}
              <li className="anim-rise" style={{ animationDelay: `${Math.min(circles.length, 8) * 50}ms` }}>
                <Link href="/kreise/neu" className="group h-full min-h-[220px] rounded-[10px] border border-dashed border-line-strong flex flex-col items-center justify-center gap-3 p-8 text-center hover:border-accent transition-colors">
                  <span className="h-11 w-11 rounded-[6px] bg-accent-soft text-accent-hover group-hover:bg-accent group-hover:text-accent-ink grid place-items-center transition-colors"><IconPlus /></span>
                  <span className="font-medium text-[16px]">Neuen Kreis gründen</span>
                  <span className="text-[13.5px] text-muted max-w-[30ch]">Für dein Haus, eine Lesegruppe oder dein Team.</span>
                </Link>
              </li>
            </ul>
          </StepSection>
        </div>
      )}
    </div>
  );
}
