import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myLoans } from "@/lib/loans/queries";
import { LoanRow } from "@/components/loan/loan-row";
import { LinkButton, PageTitle, SectionTitle } from "@/components/ui";
import { Spine } from "@/components/spine";
import { IconCheck } from "@/components/icons";

export const metadata = { title: "Vorgänge" };

/** «Meine Vorgänge», sortiert nach Handlungsbedarf: zuerst, was auf mich wartet (PRD 7.4). */
export default async function Page() {
  const user = await pageUser("/vorgaenge");
  const loans = await myLoans(user.id);
  const mine = loans.filter((l) => l.turn === "me" && l.step);
  const open = loans.filter((l) => !mine.includes(l) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(l.status));
  const done = loans.filter((l) => !mine.includes(l) && !open.includes(l));

  const tiles: [number, string, string][] = [
    [mine.length, "wartet auf dich", "#wartet"],
    [open.length, "laufend", "#laufend"],
    [done.length, "abgeschlossen", "#abgeschlossen"],
  ];

  return (
    <div>
      <PageTitle
        sub="Zuerst steht, was auf dich wartet. Danach, was gerade läuft."
        aside={loans.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "80ms" }}>
            {tiles.map(([n, l, href], i) => (
              <Tile key={l} href={n > 0 ? href : null}>
                <dd className="font-serif text-[40px] leading-none tnum flex items-center gap-2">
                  {n}
                  {i === 0 && n > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-accent live-dot" />}
                </dd>
                <dt className="text-[13px] text-muted mt-1.5">{l}</dt>
              </Tile>
            ))}
          </dl>
        )}
      >
        Vorgänge
      </PageTitle>

      {loans.length === 0 ? (
        <div className="panel-quiet px-6 py-8 md:px-10 md:py-10 grid md:grid-cols-[auto_1fr_auto] items-end gap-6 md:gap-10">
          <div aria-hidden className="flex items-end gap-1 h-[92px]">
            <Spine title="Stiller" author="Max Frisch" height={92} />
            <Spine title="Homo faber" author="Max Frisch" height={92} />
            <Spine title="Der Process" author="Franz Kafka" height={92} />
          </div>
          <p className="text-ink-2 text-[17px] max-w-md">Noch keine Vorgänge. Such ein Buch in deiner Nähe und frag es an.</p>
          <LinkButton href="/suche">Bücher suchen</LinkButton>
        </div>
      ) : (
        <div className="space-y-14 md:space-y-16">
          <section id="wartet" className="scroll-mt-24">
            <SectionTitle aside={mine.length > 0 ? `${mine.length} ${mine.length === 1 ? "Vorgang" : "Vorgänge"}` : undefined}>
              Wartet auf dich {mine.length > 0 && <span className="ml-2 inline-grid place-items-center h-7 min-w-7 px-2 rounded-full bg-accent text-accent-ink text-[14px] tnum align-middle">{mine.length}</span>}
            </SectionTitle>
            {mine.length === 0 ? (
              <div className="panel-quiet px-6 py-6 flex items-center gap-4">
                <span className="h-11 w-11 rounded-full bg-ink text-paper grid place-items-center flex-none"><IconCheck /></span>
                <div>
                  <p className="font-semibold">Alles erledigt.</p>
                  <p className="text-ink-2 text-[15px]">{open.length > 0 ? "Bei allen laufenden Vorgängen ist die andere Seite am Zug." : "Kein offener Vorgang. Zeit, etwas Neues zu lesen."}</p>
                </div>
              </div>
            ) : (
              <ul className="grid md:grid-cols-2 gap-3">{mine.map((l, i) => <LoanRow key={l.id} loan={l} variant="action" i={i} />)}</ul>
            )}
          </section>

          {open.length > 0 && (
            <section id="laufend" className="scroll-mt-24">
              <SectionTitle aside="Die andere Seite ist am Zug">Laufend</SectionTitle>
              <ul className="grid md:grid-cols-2 gap-3">{open.map((l, i) => <LoanRow key={l.id} loan={l} variant="running" i={i + mine.length} />)}</ul>
            </section>
          )}

          {done.length > 0 && (
            <section id="abgeschlossen" className="scroll-mt-24">
              <SectionTitle aside="Letzte 60 Tage">Abgeschlossen</SectionTitle>
              <ul className="panel divide-y divide-line overflow-hidden">{done.map((l, i) => <LoanRow key={l.id} loan={l} variant="done" i={i} />)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = "panel-quiet px-4 md:px-5 py-4 sm:min-w-[118px] transition-colors";
  return href ? <Link href={href} className={`${cls} hover:bg-paper-3`}>{children}</Link> : <div className={cls}>{children}</div>;
}
