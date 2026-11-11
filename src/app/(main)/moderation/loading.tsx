/** Platzhalter: Titel, Pillen-Reiter, Karten der Warteschlange */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Moderation wird geladen">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 md:mb-10">
        <div className="flex-1 min-w-[240px]">
          <div className="skeleton h-3 w-40 mb-4" />
          <div className="skeleton h-12 md:h-20 w-2/3 max-w-md mb-4" />
          <div className="skeleton h-4 w-2/3 max-w-md" />
        </div>
        <div className="flex gap-2"><div className="skeleton h-[92px] w-[124px] rounded-[14px]" /><div className="skeleton h-[92px] w-[124px] rounded-[14px]" /></div>
      </div>
      <div className="skeleton h-12 w-full max-w-[592px] rounded-full" />
      <div className="mt-8 md:mt-12 skeleton h-6 w-28 mb-5" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel rounded-[14px] p-5 md:p-6">
            <div className="flex justify-between"><div className="skeleton h-6 w-32 rounded-full" /><div className="skeleton h-3.5 w-24" /></div>
            <div className="skeleton h-7 w-2/3 mt-5" />
            <div className="skeleton h-4 w-1/2 mt-3" />
            <div className="skeleton h-9 w-28 rounded-full mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
