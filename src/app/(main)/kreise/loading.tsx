import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export default async function Loading() {
  return (
    <SkPage label={CIRCLES[await getLocale()].loading.list}>
      <SkTitle tiles={3} /><SkSection first><SkCards count={2} tall /></SkSection>
    </SkPage>
  );
}
