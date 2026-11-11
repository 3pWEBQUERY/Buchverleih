import { ShelfSkeleton } from "@/components/shelf";

export default function Loading() {
  return (
    <div aria-busy aria-label="Regal wird geladen">
      <header className="mb-8 md:mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="skeleton h-10 md:h-14 w-56 md:w-80" />
          <div className="skeleton h-4 w-40 mt-4" />
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-9 w-24" />
          <div className="skeleton h-9 w-24" />
          <div className="skeleton h-10 w-36 hidden md:block" />
        </div>
      </header>
      <div className="space-y-12 md:space-y-14">
        {[0, 1].map((i) => (
          <section key={i}>
            <div className="border-b border-line pb-2 mb-5"><div className="skeleton h-6 w-40" /></div>
            <ShelfSkeleton count={i === 0 ? 3 : 7} height={168} />
          </section>
        ))}
      </div>
    </div>
  );
}
