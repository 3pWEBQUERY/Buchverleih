/** Platzhalter in der Form der Wunschliste: Titel, Suchfeld als Pille, Karten mit Umkreis und Alarm */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wunschliste lädt">
      <div className="mb-10 md:mb-14">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-[34px] md:h-[46px] w-72 md:w-[34rem] max-w-full mt-4" />
        <div className="skeleton h-4 w-full max-w-md mt-5" />
      </div>
      <div className="skeleton h-7 w-36 mb-6" />
      <div className="skeleton h-14 w-full rounded-full" />
      <ul className="space-y-3 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="panel p-6">
            <div className="flex gap-5">
              <div className="skeleton w-[68px] h-[102px] flex-none" />
              <div className="flex-1">
                <div className="skeleton h-6" style={{ width: `${45 + ((i * 19) % 35)}%` }} />
                <div className="skeleton h-3.5 w-32 mt-2.5" />
                <div className="skeleton h-6 w-44 mt-4 rounded-full" />
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-line flex gap-5 items-center">
              <div className="skeleton h-11 w-60 rounded-full" />
              <div className="skeleton h-7 w-12 rounded-full ml-auto" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
