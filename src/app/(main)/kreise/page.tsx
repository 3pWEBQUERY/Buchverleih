import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myCircles } from "@/lib/circles";
import { Empty, LinkButton, PageTitle } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";

export const metadata = { title: "Kreise" };

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** Meine Kreise (PRD 7.5): geschlossene Gruppen mit gemeinsamem Regal. */
export default async function Page() {
  const user = await pageUser("/kreise");
  const circles = await myCircles(user.id);

  return (
    <div>
      <PageTitle
        sub="Ein Kreis ist eine geschlossene Gruppe mit gemeinsamem Regal: Nachbarschaft, Lesegruppe, Team. Leihen im Kreis zählen nicht gegen deine Limite."
        aside={circles.length > 0 && <LinkButton href="/kreise/neu">Kreis gründen</LinkButton>}
      >
        Kreise
      </PageTitle>

      {circles.length === 0 ? (
        <Empty text="Du bist noch in keinem Kreis. Gründe einen und lade per Link ein." action={<LinkButton href="/kreise/neu" variant="primary">Kreis gründen</LinkButton>} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {circles.map((c) => {
            const pending = c.my_status === "pending";
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl md:text-3xl leading-tight">{c.name}</h2>
                  {c.description && <p className="text-ink-2 mt-1.5 line-clamp-2 max-w-2xl">{c.description}</p>}
                  <p className="text-sm text-muted mt-2 tnum">
                    {pending
                      ? "Deine Beitrittsanfrage wartet auf Freigabe durch die Admins."
                      : [n(c.member_count, "Mitglied", "Mitglieder"), n(c.copy_count, "Buch", "Bücher"), c.my_role === "admin" ? "du bist Admin" : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!pending && <IconArrowRight className="flex-none text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-transform" />}
              </>
            );
            return (
              <li key={c.id}>
                {pending ? (
                  <div className="flex items-center gap-6 py-6 opacity-80">{body}</div>
                ) : (
                  <Link href={`/kreise/${c.id}`} className="group flex items-center gap-6 py-6 hover:bg-paper-2 -mx-3 px-3 rounded-xs transition-colors">{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
