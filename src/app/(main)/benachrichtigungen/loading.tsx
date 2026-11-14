import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage k="notifications">
      <SkTitle tiles={2} /><SkSection first><SkRows count={6} /></SkSection>
    </SkPage>
  );
}
