import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Erfassen wird geladen">
      <SkTitle /><SkSection first><SkCards count={3} cols={3} /></SkSection>
    </SkPage>
  );
}
