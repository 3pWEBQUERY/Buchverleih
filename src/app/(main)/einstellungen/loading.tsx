import { SkPage, SkRows, SkSection, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage k="settings">
      <SkTitle /><SkSection first><SkRows count={4} /></SkSection><SkSection><SkRows count={3} /></SkSection>
    </SkPage>
  );
}
