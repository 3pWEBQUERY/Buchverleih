/** Platzhalter in der Form der Wunschliste: Titel, Suchfeld, Zeilen mit Umkreis und Alarm */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wunschliste lädt">
      <div className="mb-8 md:mb-10">
        <div className="skeleton h-12 md:h-16 w-64 md:w-[26rem]" />
        <div className="skeleton h-4 w-full max-w-md mt-4" />
      </div>
      <div className="border-b border-line pb-3 mb-5"><div className="skeleton h-6 w-32" /></div>
      <div className="skeleton h-3.5 w-28 mb-2" />
      <div className="skeleton h-11 w-full" />
      <ul className="divide-y divide-line mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="py-5 grid grid-cols-[56px_1fr] lg:grid-cols-[56px_1fr_auto] gap-x-4 lg:gap-x-8">
            <div className="skeleton w-14 h-[84px]" />
            <div>
              <div className="skeleton h-5" style={{ width: `${45 + ((i * 19) % 35)}%` }} />
              <div className="skeleton h-3.5 w-32 mt-2" />
              <div className="skeleton h-4 w-56 mt-3" />
            </div>
            <div className="col-span-2 lg:col-span-1 mt-4 lg:mt-0 flex gap-6 items-center">
              <div className="skeleton h-10 w-full sm:w-64" />
              <div className="skeleton h-6 w-10 hidden sm:block" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
