import { SkPage, SkRows, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default function Loading() {
  return (
    <SkPage label="Vorgang wird geladen">
      <SkSheet><B className="h-[100px] rounded-[10px]" /><div className="mt-4"><B className="h-[120px] rounded-[10px]" /></div><SkSection><SkRows count={3} /></SkSection></SkSheet>
    </SkPage>
  );
}
