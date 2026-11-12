import { SkPage, SkCards, SkSection, SkShelf, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Kreis wird geladen">
      <SkTitle tiles={4} /><SkShelf /><SkSection><SkCards count={4} /></SkSection>
    </SkPage>
  );
}
