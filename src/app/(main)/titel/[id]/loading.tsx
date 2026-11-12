import { SkPage, SkCards, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { TITLE } from "@/lib/i18n/messages/title";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default async function Loading() {
  return (
    <SkPage label={TITLE[await getLocale()].loading}>
      <SkSheet><B className="h-[90px] rounded-[10px]" /><SkSection><SkCards count={2} cols={1} /></SkSection></SkSheet>
    </SkPage>
  );
}
