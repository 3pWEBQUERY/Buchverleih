import { SkPage, SkSection, SkSheet, SkShelf } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Profil wird geladen">
      <SkSheet round><SkSection first><SkShelf books={5} /></SkSection></SkSheet>
    </SkPage>
  );
}
