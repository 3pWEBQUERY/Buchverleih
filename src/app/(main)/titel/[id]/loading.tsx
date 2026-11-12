import { SkPage, SkCards, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default function Loading() {
  return (
    <SkPage label="Titel wird geladen">
      <SkSheet><B className="h-[90px] rounded-[10px]" /><SkSection><SkCards count={2} cols={1} /></SkSection></SkSheet>
    </SkPage>
  );
}
