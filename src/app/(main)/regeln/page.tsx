import { DocPage, DocSummary } from "@/components/doc";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import type { RulesContent } from "./content/types";
import { RULES_DE } from "./content/de";
import { RULES_FR } from "./content/fr";
import { RULES_IT } from "./content/it";

const RULES: Record<Locale, RulesContent> = { de: RULES_DE, fr: RULES_FR, it: RULES_IT };

export async function generateMetadata() {
  const r = RULES[await getLocale()];
  return { title: r.title, description: r.description };
}

export default async function Page() {
  const r = RULES[await getLocale()];
  return (
    <DocPage eyebrow={r.eyebrow} title={<>{r.heading[0]}<em>{r.heading[1]}</em></>} toc={r.toc} lead={r.lead}
      intro={<DocSummary eyebrow={r.summary.eyebrow} title={r.summary.title} items={r.summary.items} />}>
      {r.body}
    </DocPage>
  );
}
