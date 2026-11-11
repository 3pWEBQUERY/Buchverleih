/** Platzhalter in der Form der Titelseite: dunkler Kopf mit Cover und Titel, darunter Exemplar-Karten */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Titel lädt" className="space-y-14 md:space-y-16">
      <div className="surface-night rounded-[22px] -mx-1 md:mx-0 p-6 md:p-10 lg:p-12 grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-end">
        <div className="w-[150px] h-[226px] md:w-[210px] md:h-[316px] lg:w-[260px] lg:h-[390px] rounded-xs bg-night-2" />
        <div>
          <div className="h-3 w-24 rounded bg-night-2" />
          <div className="h-12 md:h-[72px] w-4/5 rounded bg-night-2 mt-4" />
          <div className="h-5 w-40 rounded bg-night-2 mt-5" />
          <div className="mt-8 grid grid-cols-3 gap-6 max-w-md">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded bg-night-2" />)}
          </div>
          <div className="mt-8 pt-6 border-t border-night-line"><div className="h-11 w-48 rounded-full bg-night-2" /></div>
        </div>
      </div>
      <div>
        <div className="skeleton h-7 w-72 mb-6" />
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="panel p-6 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_240px_auto] gap-5 items-center">
              <div className="col-span-2 md:col-span-1">
                <div className="skeleton h-7 w-28" />
                <div className="skeleton h-3.5 w-56 mt-3" />
                <div className="skeleton h-6 w-28 mt-3 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="skeleton h-4 w-32" />
              </div>
              <div className="skeleton h-11 w-28 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
