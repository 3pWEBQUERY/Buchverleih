/** Platzhalter in der Form der Einstellungen: Titel, Navigation links, Gruppen-Panels rechts */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Einstellungen werden geladen">
      <div className="mb-10 md:mb-14">
        <div className="skeleton h-3 w-40 mb-4" />
        <div className="skeleton h-12 md:h-20 w-2/3 md:w-1/2" />
      </div>
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="hidden lg:block space-y-2">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-7 rounded-full" style={{ width: `${60 + ((i * 17) % 35)}%` }} />)}
        </div>
        <div className="space-y-12">
          {Array.from({ length: 3 }, (_, g) => (
            <div key={g}>
              <div className="skeleton h-6 w-32 mb-2" />
              <div className="skeleton h-4 w-64 mb-5" />
              <div className="panel rounded-[14px] divide-y divide-line">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="p-5 md:p-7 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
                    <div className="mb-5 md:mb-0">
                      <div className="skeleton h-4 w-28 mb-3" />
                      <div className="skeleton h-3.5 w-48" />
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="skeleton h-12 w-full rounded-[10px]" />
                      <div className="skeleton h-9 w-36 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
