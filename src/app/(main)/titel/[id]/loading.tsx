/** Platzhalter in der Form der Titelseite: Cover links, Titel, Exemplarliste */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Titel lädt" className="md:grid md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] md:gap-12 lg:gap-16">
      <div className="mb-8 md:mb-0">
        <div className="skeleton w-[150px] h-[226px] md:w-[240px] md:h-[360px] lg:w-[300px] lg:h-[450px]" />
      </div>
      <div>
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-10 md:h-14 w-4/5 mt-3" />
        <div className="skeleton h-10 md:h-14 w-1/2 mt-2" />
        <div className="skeleton h-5 w-40 mt-5" />
        <div className="mt-6 pt-5 border-t border-line flex gap-6 items-center">
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-4 w-64 hidden sm:block" />
        </div>
        <div className="mt-12 border-b border-line pb-3 mb-1"><div className="skeleton h-6 w-60" /></div>
        <ul className="divide-y divide-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="py-4 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_190px_auto] gap-4 items-center">
              <div>
                <div className="skeleton h-5 w-28" />
                <div className="skeleton h-3.5 w-48 mt-2" />
              </div>
              <div className="hidden sm:block">
                <div className="skeleton h-3.5 w-24" />
                <div className="skeleton h-3 w-32 mt-2" />
              </div>
              <div className="skeleton h-10 w-24" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
