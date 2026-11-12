import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

export default async function Loading() {
  return (
    <SkPage label={LOANS[await getLocale()].handover.loading}>
      <SkTitle />
      <SkSection first><SkRows count={4} /></SkSection>
    </SkPage>
  );
}
