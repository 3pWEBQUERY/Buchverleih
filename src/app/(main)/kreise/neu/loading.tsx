import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Formular wird geladen">
      <SkTitle /><SkSection first><SkRows count={4} /></SkSection>
    </SkPage>
  );
}
