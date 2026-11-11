/** Platzhalter in der Form der Benachrichtigungsliste */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Benachrichtigungen lädt">
      <div className="mb-8 md:mb-10">
        <div className="skeleton h-12 md:h-16 w-72 md:w-[34rem] max-w-full" />
        <div className="skeleton h-4 w-56 mt-4" />
      </div>
      <div className="border-b border-line pb-3"><div className="skeleton h-6 w-16" /></div>
      <ul className="divide-y divide-line">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="grid grid-cols-[6px_1fr_auto] gap-x-3.5 md:gap-x-5 py-4">
            <span />
            <div>
              <div className="skeleton h-4" style={{ width: `${50 + ((i * 29) % 40)}%` }} />
              <div className="skeleton h-3.5 mt-2" style={{ width: `${35 + ((i * 13) % 30)}%` }} />
            </div>
            <div className="skeleton h-3.5 w-16" />
          </li>
        ))}
      </ul>
    </div>
  );
}
