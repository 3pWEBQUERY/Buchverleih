import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";
import { cx } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { WISHLIST } from "@/lib/i18n/messages/wishlist";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default async function Loading() {
  return (
    <SkPage label={WISHLIST[await getLocale()].loading}>
      <SkTitle tiles={3} /><SkSection first><B className="h-[52px] rounded-[8px]" /></SkSection><SkSection><SkCards count={4} tall /></SkSection>
    </SkPage>
  );
}
