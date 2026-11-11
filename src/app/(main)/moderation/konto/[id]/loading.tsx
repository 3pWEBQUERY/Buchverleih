/** Platzhalter: Kopf mit Initiale, Zahlenkacheln, Vorgänge und Massnahmen */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Konto wird geladen">
      <div className="skeleton h-9 w-28 rounded-full mb-8" />
      <div className="flex items-center gap-7 mb-12">
        <div className="skeleton h-20 w-20 md:h-24 md:w-24 rounded-full flex-none" />
        <div className="flex-1"><div className="skeleton h-3 w-40 mb-3" /><div className="skeleton h-12 md:h-16 w-1/3 mb-3" /><div className="skeleton h-4 w-1/2" /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-14">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-[92px] rounded-[8px]" />)}
      </div>
      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7 panel rounded-[8px] divide-y divide-line">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex justify-between gap-6 px-5 py-4">
              <div className="flex-1"><div className="skeleton h-5 w-1/2 mb-2" /><div className="skeleton h-3 w-1/3" /></div>
              <div className="skeleton h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-5 skeleton h-64 rounded-[8px]" />
      </div>
    </div>
  );
}
