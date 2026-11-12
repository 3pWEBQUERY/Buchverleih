import { getLocale } from "@/lib/i18n/server";
import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage label={({ de: "Erfassen wird geladen", fr: "Chargement de l’ajout", it: "Caricamento dell’aggiunta" })[await getLocale()]}>
      <SkTitle /><SkSection first><SkCards count={3} cols={3} /></SkSection>
    </SkPage>
  );
}
