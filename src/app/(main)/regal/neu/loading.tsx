import { SkPage, SkCards, SkSection, SkTitle } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage k="capture">
      <SkTitle /><SkSection first><SkCards count={3} cols={3} /></SkSection>
    </SkPage>
  );
}
