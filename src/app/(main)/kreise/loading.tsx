import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Kreise werden geladen">
      <SkTitle tiles={3} /><SkSection first><SkCards count={2} tall /></SkSection>
    </SkPage>
  );
}
