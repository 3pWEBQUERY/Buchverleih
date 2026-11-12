import { SkPage, SkCards, SkSection, SkShelf, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export default async function Loading() {
  return (
    <SkPage label={CIRCLES[await getLocale()].loading.detail}>
      <SkTitle tiles={4} /><SkShelf /><SkSection><SkCards count={4} /></SkSection>
    </SkPage>
  );
}
