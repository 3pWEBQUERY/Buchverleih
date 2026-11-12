import { SkPage, SkRows, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default async function Loading() {
  return (
    <SkPage label={LOANS[await getLocale()].detail.loading}>
      <SkSheet><B className="h-[100px] rounded-[10px]" /><div className="mt-4"><B className="h-[120px] rounded-[10px]" /></div><SkSection><SkRows count={3} /></SkSection></SkSheet>
    </SkPage>
  );
}
