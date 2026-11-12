import { getLocale } from "@/lib/i18n/server";
import { SkPage, SkSection, SkSheet } from "@/components/skeleton";
import { cx } from "@/components/ui";

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export default async function Loading() {
  return (
    <SkPage label={({ de: "Buch wird geladen", fr: "Chargement du livre", it: "Caricamento del libro" })[await getLocale()]}>
      <SkSheet><B className="h-9 w-full max-w-lg rounded-[8px]" /><div className="mt-6"><B className="h-[96px] rounded-[10px]" /></div><SkSection><B className="h-[180px] rounded-[10px]" /></SkSection></SkSheet>
    </SkPage>
  );
}
