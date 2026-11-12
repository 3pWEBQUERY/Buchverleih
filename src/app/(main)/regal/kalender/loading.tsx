import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Kalender wird geladen">
      <SkTitle tiles={3} /><SkSection first><SkRows count={5} /></SkSection>
    </SkPage>
  );
}
