import { SkPage, SkSheet } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { PROFILE } from "@/lib/i18n/messages/profile";

export default async function Loading() {
  return (
    <SkPage label={PROFILE[await getLocale()].loading}>
      <SkSheet round />
    </SkPage>
  );
}
