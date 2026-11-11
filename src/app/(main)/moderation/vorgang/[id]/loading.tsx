/** Platzhalter: Titel, Fälle links, Stammdaten und Verlauf rechts */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Vorgang wird geladen">
      <div className="skeleton h-3.5 w-24 mb-8" />
      <div className="skeleton h-3 w-32 mb-4" />
      <div className="skeleton h-10 md:h-14 w-2/3 mb-4" />
      <div className="skeleton h-5 w-1/2 mb-12" />
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="skeleton h-6 w-20 mb-6" />
          <div className="skeleton h-4 w-3/4 mb-3" />
          <div className="flex gap-3 my-5"><div className="skeleton h-36 w-24" /><div className="skeleton h-36 w-24" /></div>
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-4 w-full mb-4" />)}
        </div>
        <div className="lg:col-span-5">
          <div className="skeleton h-6 w-32 mb-6" />
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="flex justify-between py-3 border-b border-line"><div className="skeleton h-3.5 w-20" /><div className="skeleton h-3.5 w-28" /></div>)}
        </div>
      </div>
    </div>
  );
}
