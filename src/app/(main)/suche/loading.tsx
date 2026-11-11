/** Platzhalter in der Form der Suche: Feld, Trefferliste, Filterspalte */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Suche lädt">
      <div className="skeleton h-12 md:h-16 w-48 md:w-72 mb-6 md:mb-8" />
      <div className="skeleton h-14 w-full" />
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_232px] lg:gap-12">
        <div>
          <div className="border-b border-line pb-3 mb-1"><div className="skeleton h-4 w-56" /></div>
          <ul className="divide-y divide-line">
            {Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="grid grid-cols-[48px_1fr_auto] gap-4 items-center py-3.5">
                <div className="skeleton w-12 h-[72px]" />
                <div>
                  <div className="skeleton h-5" style={{ width: `${50 + ((i * 23) % 40)}%` }} />
                  <div className="skeleton h-3.5 w-1/3 mt-2" />
                  <div className="skeleton h-3 w-2/5 mt-2.5" />
                </div>
                <div className="skeleton h-4 w-12 self-start mt-1" />
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden lg:block space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton h-3.5 w-20 mb-2" />
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
