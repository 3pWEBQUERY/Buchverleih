/** Platzhalter in der Form der Einstellungen: Titel, dann ruhige Abschnitte */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Einstellungen werden geladen">
      <div className="max-w-4xl">
        <div className="skeleton h-10 md:h-14 w-2/3 mb-4" />
        <div className="skeleton h-4 w-1/3 mb-10" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-t border-line py-8 md:py-10 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-14">
            <div className="mb-5 md:mb-0">
              <div className="skeleton h-6 w-32 mb-3" />
              <div className="skeleton h-3.5 w-48" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
