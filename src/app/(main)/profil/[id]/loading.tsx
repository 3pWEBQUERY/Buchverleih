import { SkPage, SkSection, SkSheet, SkShelf } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { PROFILE } from "@/lib/i18n/messages/profile";

export default async function Loading() {
  return (
    <SkPage label={PROFILE[await getLocale()].loading}>
      <SkSheet round><SkSection first><SkShelf books={5} /></SkSection></SkSheet>
    </SkPage>
  );
}
