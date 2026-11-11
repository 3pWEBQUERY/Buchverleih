import { ShelfSkeleton } from "@/components/shelf";

export default function Loading() {
  return (
    <div aria-busy aria-label="Kreis wird geladen">
      <div className="skeleton h-4 w-16 mb-6 md:mb-8" />
      <header className="mb-10 md:mb-14 max-w-3xl">
        <div className="skeleton h-3 w-48" />
        <div className="skeleton h-10 md:h-14 w-72 md:w-[30rem] mt-4" />
        <div className="skeleton h-4 w-full mt-5" />
        <div className="skeleton h-4 w-4/5 mt-2" />
      </header>
      <div className="grid md:grid-cols-12 gap-x-12 gap-y-14">
        <div className="md:col-span-8 space-y-14">
          <section>
            <div className="border-b border-line pb-2 mb-5"><div className="skeleton h-6 w-48" /></div>
            <ShelfSkeleton count={5} height={160} />
          </section>
          <section>
            <div className="border-b border-line pb-2 mb-5"><div className="skeleton h-6 w-32" /></div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="py-3.5 border-b border-line"><div className="skeleton h-4 w-28" /><div className="skeleton h-3 w-40 mt-2" /></div>
            ))}
          </section>
        </div>
        <aside className="md:col-span-4">
          <div className="border-b border-line pb-2 mb-5"><div className="skeleton h-6 w-24" /></div>
          <div className="skeleton h-11 w-full" />
        </aside>
      </div>
    </div>
  );
}
