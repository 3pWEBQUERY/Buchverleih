import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Vorgänge werden geladen">
      <SkTitle tiles={3} /><SkSection first><SkCards count={2} tall /></SkSection><SkSection><SkCards count={2} /></SkSection>
    </SkPage>
  );
}
