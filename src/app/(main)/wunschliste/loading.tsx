import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default function Loading() {
  return (
    <SkPage label="Wunschliste wird geladen">
      <SkTitle tiles={3} /><SkSection first><B className="h-[52px] rounded-[8px]" /></SkSection><SkSection><SkCards count={4} tall /></SkSection>
    </SkPage>
  );
}
