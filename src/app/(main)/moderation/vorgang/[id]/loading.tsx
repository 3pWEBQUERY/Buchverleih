/** Platzhalter: Titel, Fall-Karten links, Stammdaten und Verlauf rechts */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Vorgang wird geladen">
      <div className="skeleton h-9 w-36 rounded-full mb-8" />
      <div className="skeleton h-3 w-32 mb-4" />
      <div className="skeleton h-12 md:h-20 w-2/3 mb-5" />
      <div className="flex gap-2 mb-14"><div className="skeleton h-6 w-28 rounded-full" /><div className="skeleton h-6 w-28 rounded-full" /></div>
      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="skeleton h-6 w-24 mb-5" />
          <div className="panel rounded-[14px] p-6">
            <div className="skeleton h-6 w-32 rounded-full" />
            <div className="skeleton h-6 w-40 mt-5" />
            <div className="skeleton h-4 w-3/4 mt-3" />
            <div className="flex gap-3 my-6"><div className="skeleton h-36 w-24" /><div className="skeleton h-36 w-24" /></div>
            <div className="skeleton h-40 w-full rounded-[12px]" />
          </div>
        </div>
        <div className="lg:col-span-5 panel-quiet rounded-[14px] p-6">
          <div className="skeleton h-5 w-32 mb-5" />
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="flex justify-between py-3 border-b border-line"><div className="skeleton h-3.5 w-20" /><div className="skeleton h-3.5 w-28" /></div>)}
        </div>
      </div>
    </div>
  );
}
