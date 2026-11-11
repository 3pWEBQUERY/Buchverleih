import { ShelfSkeleton } from "@/components/shelf";

/** Platzhalter in der Form des Profils: Name, drei Zahlen, Regal */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Profil lädt" className="space-y-12 md:space-y-16">
      <div>
        <div className="skeleton h-3 w-56" />
        <div className="skeleton h-12 md:h-[72px] w-40 md:w-64 mt-3" />
        <div className="skeleton h-4 w-28 mt-5" />
      </div>
      <div className="grid grid-cols-3 border-y border-line divide-x divide-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-5 md:py-7 px-3 md:px-6 first:pl-0">
            <div className="skeleton h-9 md:h-14 w-14 md:w-24" />
            <div className="skeleton h-3.5 w-4/5 mt-3" />
          </div>
        ))}
      </div>
      <div>
        <div className="border-b border-line pb-3 mb-5"><div className="skeleton h-6 w-48" /></div>
        <ShelfSkeleton />
      </div>
    </div>
  );
}
