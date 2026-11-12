import { SkPage, SkCards, SkSection, SkSheet } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Buch wird geladen">
      <SkSheet><SkSection first><SkCards count={3} cols={3} /></SkSection></SkSheet>
    </SkPage>
  );
}
