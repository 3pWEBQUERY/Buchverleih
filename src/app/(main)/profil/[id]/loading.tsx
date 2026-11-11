/** Platzhalter in der Form des Profils: Monogramm und Name, drei Zahlen, Regal auf dunkler Fläche */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Profil lädt" className="space-y-12 md:space-y-16">
      <div className="grid grid-cols-[auto_1fr] gap-x-5 md:gap-x-10 gap-y-6 items-end">
        <div className="skeleton h-24 w-24 md:h-[168px] md:w-[168px] rounded-full" />
        <div>
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-12 md:h-[76px] w-40 md:w-72 mt-3" />
        </div>
        <div className="col-span-2 skeleton h-8 w-64 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel-quiet px-4 py-5 md:px-7 md:py-7">
            <div className="skeleton h-9 md:h-16 w-14 md:w-28" />
            <div className="skeleton h-3.5 w-4/5 mt-3" />
          </div>
        ))}
      </div>
      <div className="surface-night rounded-[12px] px-5 md:px-9 pt-8 md:pt-10 pb-8 -mx-1 md:mx-0">
        <div className="h-3 w-20 rounded bg-night-2" />
        <div className="h-10 w-56 rounded bg-night-2 mt-3 mb-8" />
        <div className="flex gap-5 items-end overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-none w-[112px]">
              <div className="rounded-xs bg-night-2" style={{ height: 152 + (i % 4) * 8 }} />
              <div className="h-[3px] bg-night-ink/30 rounded-full mt-0" />
              <div className="h-3 w-4/5 rounded bg-night-2 mt-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
