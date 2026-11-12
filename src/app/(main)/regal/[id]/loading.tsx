import { getLocale } from "@/lib/i18n/server";
import { SkPage, SkCards, SkSection, SkSheet } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage label={({ de: "Buch wird geladen", fr: "Chargement du livre", it: "Caricamento del libro" })[await getLocale()]}>
      <SkSheet><SkSection first><SkCards count={3} cols={3} /></SkSection></SkSheet>
    </SkPage>
  );
}
