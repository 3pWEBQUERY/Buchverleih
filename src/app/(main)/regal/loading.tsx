import { getLocale } from "@/lib/i18n/server";
import { SHELF } from "@/lib/i18n/messages/shelf";
import { SkPage, SkCards, SkSection, SkShelf, SkTitle } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage label={SHELF[await getLocale()].loading}>
      <SkTitle tiles={4} /><SkSection first><SkCards count={2} /></SkSection><SkSection><SkShelf /></SkSection>
    </SkPage>
  );
}
