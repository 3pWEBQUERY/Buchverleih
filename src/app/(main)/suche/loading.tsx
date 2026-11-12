import { SkPage, SkRows, SkSection, SkShelf, SkTitle } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default function Loading() {
  return (
    <SkPage label="Suche wird geladen">
      <SkTitle /><B className="h-[60px] rounded-[10px]" /><SkSection><SkShelf /></SkSection><SkSection><SkRows count={5} /></SkSection>
    </SkPage>
  );
}
