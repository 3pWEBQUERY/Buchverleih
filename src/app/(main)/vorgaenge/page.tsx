import { pageUser } from "@/lib/page";
import { myLoans } from "@/lib/loans/queries";
import { LoanRow } from "@/components/loan/loan-row";
import { Empty, LinkButton, PageTitle, SectionTitle } from "@/components/ui";

export const metadata = { title: "Vorgänge" };

/** «Meine Vorgänge», sortiert nach Handlungsbedarf: zuerst, was auf mich wartet (PRD 7.4). */
export default async function Page() {
  const user = await pageUser("/vorgaenge");
  const loans = await myLoans(user.id);
  const mine = loans.filter((l) => l.turn === "me" && l.step);
  const open = loans.filter((l) => !mine.includes(l) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(l.status));
  const done = loans.filter((l) => !mine.includes(l) && !open.includes(l));

  return (
    <div>
      <PageTitle sub="Zuerst steht, was auf dich wartet.">Vorgänge</PageTitle>
      {loans.length === 0 ? (
        <Empty text="Noch keine Vorgänge. Such ein Buch in deiner Nähe." action={<LinkButton href="/suche">Suchen</LinkButton>} />
      ) : (
        <div className="space-y-12">
          {mine.length > 0 && (
            <section>
              <SectionTitle aside={`${mine.length}`}>Wartet auf dich</SectionTitle>
              <ul className="divide-y divide-line border-b border-line">{mine.map((l) => <LoanRow key={l.id} loan={l} />)}</ul>
            </section>
          )}
          {open.length > 0 && (
            <section>
              <SectionTitle aside={`${open.length}`}>Laufend</SectionTitle>
              <ul className="divide-y divide-line border-b border-line">{open.map((l) => <LoanRow key={l.id} loan={l} />)}</ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <SectionTitle aside="letzte 60 Tage">Abgeschlossen</SectionTitle>
              <ul className="divide-y divide-line border-b border-line opacity-80">{done.map((l) => <LoanRow key={l.id} loan={l} />)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
