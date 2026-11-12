import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

export default async function Loading() {
  return (
    <SkPage label={LOANS[await getLocale()].list.loading}>
      <SkTitle tiles={3} /><SkSection first><SkCards count={2} tall /></SkSection><SkSection><SkCards count={2} /></SkSection>
    </SkPage>
  );
}
