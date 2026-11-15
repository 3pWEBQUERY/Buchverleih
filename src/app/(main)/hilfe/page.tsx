import Link from "next/link";
import { DocPage } from "@/components/doc";
import { IconArrowRight } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import type { HelpContent } from "./content/types";
import { HELP_DE } from "./content/de";
import { HELP_FR } from "./content/fr";
import { HELP_IT } from "./content/it";
import { HELP_EN } from "./content/en";

const HELP: Record<Locale, HelpContent> = { de: HELP_DE, fr: HELP_FR, it: HELP_IT, en: HELP_EN };

export async function generateMetadata() {
  const h = HELP[await getLocale()];
  return { title: h.title, description: h.description };
}

export default async function Page() {
  const h = HELP[await getLocale()];
  return (
    <DocPage eyebrow={h.eyebrow} title={<>{h.heading[0]}<em>{h.heading[1]}</em></>} toc={h.toc} intro={<QuickStart q={h.quick} />} lead={h.lead}>
      {h.body}
    </DocPage>
  );
}

/** Schnellstart: die vier Schritte einer Leihe als Karten */
function QuickStart({ q }: { q: HelpContent["quick"] }) {
  return (
    <section aria-labelledby="schnellstart">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5 md:mb-6">
        <div>
          <p className="eyebrow">{q.eyebrow}</p>
          <h2 id="schnellstart" className="text-title font-title tracking-title mt-2">{q.title}</h2>
        </div>
        <p className="text-body-sm text-muted">{q.note}</p>
      </div>
      <ol className="grid grid-flow-col auto-cols-[78%] sm:auto-cols-[46%] lg:grid-flow-row lg:grid-cols-4 gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 pb-1" style={{ scrollbarWidth: "none" }}>
        {q.steps.map(([n, title, text, href, more], i) => (
          <li key={n} className="snap-start">
            <Link href={href} className="press-card group rounded-md border border-line p-5 flex flex-col h-full min-h-[210px] hover:border-accent duration-fast">
              <span className="text-meta tnum text-accent-hover font-medium">{n}</span>
              <span className="font-medium text-lead mt-3">{title}</span>
              <span className="text-muted text-body-sm mt-1.5 leading-relaxed">{text}</span>
              <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-hover">
                {more} <IconArrowRight width={15} height={15} className="transition-transform duration-fast group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
