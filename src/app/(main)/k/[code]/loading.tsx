import { SkPage, SkRows, SkTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Einladung wird geladen">
      <div className="max-w-xl"><SkTitle /><SkRows count={2} /></div>
    </SkPage>
  );
}
