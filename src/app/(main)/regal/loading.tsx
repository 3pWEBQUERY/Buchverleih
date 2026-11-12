import { SkPage, SkCards, SkSection, SkShelf, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Regal wird geladen">
      <SkTitle tiles={4} /><SkSection first><SkCards count={2} /></SkSection><SkSection><SkShelf /></SkSection>
    </SkPage>
  );
}
