import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myCircles } from "@/lib/circles";
import { circlePreviews } from "@/lib/kreise-queries";
import { LinkButton, PageTitle } from "@/components/ui";
import { Spine } from "@/components/spine";
import { Faces } from "@/components/kreise/faces";
import { IconArrowRight, IconPlus } from "@/components/icons";

export const metadata = { title: "Kreise" };

/** Meine Kreise (PRD 7.5): geschlossene Gruppen mit gemeinsamem Regal. */
export default async function Page() {
  const user = await pageUser("/kreise");
  const circles = await myCircles(user.id);
  const previews = await circlePreviews(circles.map((c) => c.id));

  return (
    <div>
      <PageTitle
        sub="Ein Kreis ist eine geschlossene Gruppe mit gemeinsamem Regal: Nachbarschaft, Lesegruppe, Team. Leihen im Kreis zählen nicht gegen deine Limite."
        aside={circles.length > 0 && <LinkButton href="/kreise/neu" variant="ghost"><IconPlus width={18} height={18} /> Kreis gründen</LinkButton>}
      >
        <em>Kreise</em>
      </PageTitle>

      {circles.length === 0 ? (
        <section className="rounded-[22px] bg-accent text-accent-ink p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <p className="eyebrow !text-accent-ink/75">Noch in keinem Kreis</p>
            <h2 className="display text-[44px] md:text-[64px] mt-3 max-w-[15ch]">Ein Regal für dein Haus, <em>deine Lesegruppe, dein Team.</em></h2>
            <p className="mt-5 text-[16px] text-accent-ink/85 max-w-md">Gründe einen Kreis und lade per Link ein.</p>
          </div>
          <Link href="/kreise/neu" className="h-14 px-7 rounded-full bg-night text-night-ink font-semibold inline-flex items-center gap-2 justify-center"><IconPlus width={20} height={20} /> Kreis gründen</Link>
        </section>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3 md:gap-4">
          {circles.map((c, i) => {
            const pending = c.my_status === "pending";
            const p = previews[c.id] ?? { names: [], books: [] };
            const body = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">{pending ? "Anfrage gesendet" : c.my_role === "admin" ? "Du bist Admin" : "Mitglied"}</p>
                    <h2 className="font-serif text-[34px] md:text-[42px] leading-[0.95] mt-2.5 break-words">{c.name}</h2>
                  </div>
                  {!pending && (
                    <span aria-hidden className="h-11 w-11 flex-none rounded-full border border-line-strong grid place-items-center transition-colors group-hover:bg-ink group-hover:text-paper group-hover:border-ink">
                      <IconArrowRight width={18} height={18} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
                {c.description && <p className="text-ink-2 text-[15px] mt-3 line-clamp-2">{c.description}</p>}

                {/* Ein kleines Brett mit den Buchrücken des Kreises */}
                <div aria-hidden className="mt-6 h-[84px] rounded-[12px] bg-paper-2 px-4 pt-3 flex items-end gap-[3px] overflow-hidden relative">
                  {p.books.length > 0 ? p.books.map((b, k) => <Spine key={k} title={b.title} author={b.author} height={70} className="!transition-none" />) : (
                    <span className="self-center pb-3 text-[13.5px] text-muted">Noch keine Bücher im Kreis.</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ink" />
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  {pending ? (
                    <p className="text-[14px] text-muted">Deine Beitrittsanfrage wartet auf Freigabe durch die Admins.</p>
                  ) : (
                    <Faces names={p.names} total={c.member_count} />
                  )}
                  <dl className="flex gap-5 flex-none">
                    <div className="text-right"><dd className="font-serif text-[30px] leading-none tnum">{c.member_count}</dd><dt className="text-[12px] text-muted mt-1">{c.member_count === 1 ? "Mitglied" : "Mitglieder"}</dt></div>
                    <div className="text-right"><dd className="font-serif text-[30px] leading-none tnum">{c.copy_count}</dd><dt className="text-[12px] text-muted mt-1">{c.copy_count === 1 ? "Buch" : "Bücher"}</dt></div>
                  </dl>
                </div>
              </>
            );
            return (
              <li key={c.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                {pending ? (
                  <div className="panel !rounded-[18px] p-5 md:p-7 h-full opacity-80">{body}</div>
                ) : (
                  <Link href={`/kreise/${c.id}`} className="group panel !rounded-[18px] p-5 md:p-7 h-full block hover:border-ink transition-colors">{body}</Link>
                )}
              </li>
            );
          })}
          <li className="anim-rise" style={{ animationDelay: `${Math.min(circles.length, 8) * 50}ms` }}>
            <Link href="/kreise/neu" className="group h-full min-h-[200px] rounded-[18px] border border-dashed border-line-strong flex flex-col items-center justify-center gap-3 p-8 text-center hover:border-ink hover:bg-paper-2 transition-colors">
              <span className="h-12 w-12 rounded-full bg-paper-2 group-hover:bg-ink group-hover:text-paper grid place-items-center transition-colors"><IconPlus /></span>
              <span className="font-semibold">Neuen Kreis gründen</span>
              <span className="text-[14px] text-muted max-w-[28ch]">Für dein Haus, eine Lesegruppe oder dein Team.</span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
