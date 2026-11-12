import { SkCards, SkPage, SkSection, SkShelf, SkTitle } from "@/components/skeleton";

/** Start und alle Seiten ohne eigenes Skelett */
export default function Loading() {
  return (
    <SkPage label="Seite wird geladen">
      <SkTitle tiles={3} />
      <SkSection first><SkCards count={2} tall /></SkSection>
      <SkSection><SkShelf /></SkSection>
    </SkPage>
  );
}
