import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Moderation wird geladen">
      <SkTitle tiles={3} /><SkSection first><SkRows count={6} /></SkSection>
    </SkPage>
  );
}
