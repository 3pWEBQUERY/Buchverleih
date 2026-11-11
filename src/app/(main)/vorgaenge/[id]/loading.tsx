export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt">
      <div className="skeleton h-4 w-28 mb-8" />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 md:gap-10 items-end">
        <div className="skeleton h-[132px] w-[88px] md:h-[212px] md:w-[140px] rounded-xs" />
        <div>
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-10 md:h-[68px] w-4/5 mt-4 rounded-[10px]" />
          <div className="skeleton h-6 w-28 mt-5 rounded-full" />
        </div>
      </div>
      <div className="mt-12 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-10">
        <div className="space-y-8">
          <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-1.5 rounded-full" />)}</div>
          <div className="skeleton h-64 rounded-[12px]" />
          <div className="skeleton h-72 rounded-[10px]" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-56 rounded-[10px]" />
          <div className="skeleton h-40 rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
