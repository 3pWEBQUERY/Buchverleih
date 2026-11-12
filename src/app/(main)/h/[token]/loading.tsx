import { SkPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPage label="Code wird geprüft">
      <div className="min-h-[60vh] grid place-items-center py-2 md:py-8">
        <div className="w-full max-w-md rounded-[12px] border border-line p-7 md:p-10 flex flex-col items-center">
          <div className="skeleton h-14 w-14 rounded-full" />
          <div className="skeleton h-3 w-20 mt-6" />
          <div className="skeleton h-10 w-56 mt-3 rounded-[8px]" />
        </div>
      </div>
    </SkPage>
  );
}
