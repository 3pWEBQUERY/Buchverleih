import { SkPage, SkCards, SkSection, SkSheet } from "@/components/skeleton";

export default async function Loading() {
  return (
    <SkPage k="book">
      <SkSheet><SkSection first><SkCards count={3} cols={3} /></SkSection></SkSheet>
    </SkPage>
  );
}
