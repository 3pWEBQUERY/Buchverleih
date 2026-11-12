import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export default async function Loading() {
  return (
    <SkPage label={CIRCLES[await getLocale()].loading.form}>
      <SkTitle /><SkSection first><SkRows count={4} /></SkSection>
    </SkPage>
  );
}
