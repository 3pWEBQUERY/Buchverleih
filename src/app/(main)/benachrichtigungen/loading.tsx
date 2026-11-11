/** Platzhalter in der Form der Benachrichtigungen: Titel, Liste mit Symbol, Text und Zeit */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Benachrichtigungen lädt">
      <div className="mb-10 md:mb-14">
        <div className="skeleton h-3 w-48" />
        <div className="skeleton h-11 md:h-[76px] w-full max-w-[38rem] mt-4" />
      </div>
      <div className="skeleton h-7 w-20 mb-4" />
      <ul className="panel divide-y divide-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="grid grid-cols-[40px_1fr_auto] gap-x-4 px-4 md:px-6 py-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div>
              <div className="skeleton h-4" style={{ width: `${50 + ((i * 29) % 40)}%` }} />
              <div className="skeleton h-3.5 mt-2" style={{ width: `${35 + ((i * 13) % 30)}%` }} />
            </div>
            <div className="skeleton h-3.5 w-14" />
          </li>
        ))}
      </ul>
    </div>
  );
}
