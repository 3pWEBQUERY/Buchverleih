export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Titel wird geladen" className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
          <div className="skeleton h-[156px] lg:h-[396px] rounded-[12px]" />
          <div><div className="skeleton h-8 w-3/4" /><div className="skeleton h-4 w-1/3 mt-2" /></div>
        </div>
        <div className="skeleton h-40 rounded-[10px]" />
      </div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><div className="skeleton h-3 w-28" /><div className="skeleton h-[34px] md:h-[42px] w-72 mt-3 rounded-[10px]" /></div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] w-[100px] rounded-[8px]" />)}</div>
        </div>
        <div className="md:pl-[72px] mt-14 space-y-3">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[150px] rounded-[10px]" />)}
        </div>
      </div>
    </div>
  );
}
