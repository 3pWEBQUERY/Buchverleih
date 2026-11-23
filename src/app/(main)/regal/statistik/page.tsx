import Link from "next/link";
import { pageUser } from "@/lib/page";
import { getLocale } from "@/lib/i18n/server";
import { STATS } from "@/lib/i18n/messages/stats";
import { entitlements } from "@/lib/trust";
import { sql } from "@/lib/db";
import { shelfStats } from "@/lib/stats";
import { fmtDay } from "@/lib/dates";
import { LinkButton, PageTitle } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
import { MonthBars } from "@/components/month-bars";

export async function generateMetadata() {
  return { title: STATS[await getLocale()].title };
}

/** Regalstatistik (PRD 11.2, Fördermitgliedschaft) */
export default async function Page() {
  const user = await pageUser("/regal/statistik");
  const l = await getLocale();
  const t = STATS[l];
  const ent = await entitlements(sql, user.plan_id);
  if (!ent.shelf_stats) {
    return (
      <div className="max-w-2xl">
        <PageTitle eyebrow={t.eyebrow}>{t.heading[0]}<em>{t.heading[1]}</em></PageTitle>
        <p className="text-lead text-ink-2">{t.locked}</p>
        <LinkButton href="/einstellungen#foerdern" variant="primary" className="mt-6">{t.becomeSupporter}</LinkButton>
      </div>
    );
  }
  const { totals, byMonth, books } = await shelfStats(user.id);
  return (
    <div>
      <PageTitle eyebrow={t.eyebrow} sub={t.lead}
        aside={<a href="/api/v1/copies/export" className="inline-flex h-11 items-center px-5 rounded-sm bg-accent-soft text-accent-hover font-medium hover:bg-accent hover:text-accent-ink transition-colors" download>{t.csv}</a>}>
        {t.heading[0]}<em>{t.heading[1]}</em>
      </PageTitle>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-10">
        <StatTile n={totals.loans} label={t.loans} />
        <StatTile n={totals.lent_now} label={t.lentNow} live={totals.lent_now > 0} />
        <StatTile n={totals.borrowers} label={t.borrowers} />
        <StatTile n={totals.days_out} label={t.daysOut} />
      </dl>
      <StepSection n={1} first title={t.perMonth} desc={t.perMonthDesc}>
        <MonthBars data={byMonth} label={t.perMonth} l={l} unit={t.unit} />
      </StepSection>
      <StepSection n={2} title={t.books} desc={t.booksDesc}>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-meta text-muted border-b border-line">
                <th scope="col" className="py-2 pr-4 font-medium">{t.colTitle}</th>
                <th scope="col" className="py-2 pr-4 font-medium text-right">{t.colLoans}</th>
                <th scope="col" className="py-2 pr-4 font-medium text-right">{t.colDays}</th>
                <th scope="col" className="py-2 font-medium text-right">{t.colLast}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {books.map((b) => (
                <tr key={b.copy_id}>
                  <td className="py-2.5 pr-4"><Link href={`/regal/${b.copy_id}`} className="font-serif text-body hover:underline underline-offset-4">{b.title}</Link><span className="block text-meta text-muted">{b.authors.join(", ")}</span></td>
                  <td className="py-2.5 pr-4 text-right tnum">{b.loans}</td>
                  <td className="py-2.5 pr-4 text-right tnum">{b.days_out}</td>
                  <td className="py-2.5 text-right tnum text-muted whitespace-nowrap">{b.last_at ? fmtDay(b.last_at, l) : t.never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StepSection>
    </div>
  );
}
