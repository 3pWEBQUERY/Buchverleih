/** Platzhalter in der Form der Suche: Titel, Suchfeld als Pille, Filter-Chips, Kartenraster */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Suche lädt">
      <div className="mb-8 md:mb-10">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-[34px] md:h-[46px] w-[85%] md:w-[620px] mt-4" />
        <div className="skeleton h-[34px] md:h-[46px] w-1/2 md:w-[360px] mt-2 md:hidden" />
      </div>
      <div className="skeleton h-[34px] md:h-[46px] w-full rounded-full" />
      <div className="mt-5 flex gap-2 overflow-hidden">
        {[230, 104, 82, 96, 120, 104, 96, 104].map((w, i) => (
          <div key={i} className="skeleton h-10 rounded-full flex-none" style={{ width: w }} />
        ))}
      </div>
      <div className="skeleton h-5 w-64 mt-10 md:mt-12 mb-5" />
      <ul className="grid md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="panel flex gap-5 p-5">
            <div className="skeleton w-[76px] h-[112px] flex-none" />
            <div className="flex-1">
              <div className="skeleton h-6" style={{ width: `${50 + ((i * 23) % 40)}%` }} />
              <div className="skeleton h-3.5 w-1/3 mt-2.5" />
              <div className="skeleton h-6 w-32 mt-8 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
