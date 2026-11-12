import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Benachrichtigungen werden geladen">
      <SkTitle tiles={2} /><SkSection first><SkRows count={6} /></SkSection>
    </SkPage>
  );
}
