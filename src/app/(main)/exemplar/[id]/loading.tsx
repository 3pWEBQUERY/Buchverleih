import { SkPage, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default async function Loading() {
  return (
    <SkPage k="book">
      <SkSheet><B className="h-9 w-full max-w-lg rounded-md" /><div className="mt-6"><B className="h-[96px] rounded-md" /></div><SkSection><B className="h-[180px] rounded-md" /></SkSection></SkSheet>
    </SkPage>
  );
}
