import { getLocale } from "@/lib/i18n/server";
import { SHELF } from "@/lib/i18n/messages/shelf";
import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage label={SHELF[await getLocale()].cal.loading}>
      <SkTitle tiles={3} /><SkSection first><SkRows count={5} /></SkSection>
    </SkPage>
  );
}
