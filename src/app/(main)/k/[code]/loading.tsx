import { SkPage, SkRows, SkTitle } from "@/components/skeleton";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export default async function Loading() {
  return (
    <SkPage label={CIRCLES[await getLocale()].loading.invite}>
      <div className="max-w-xl"><SkTitle /><SkRows count={2} /></div>
    </SkPage>
  );
}
