export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Profil wird geladen" className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-5 items-center lg:block lg:space-y-5">
          <div className="skeleton h-[88px] lg:h-[218px] rounded-full lg:rounded-[12px]" />
          <div><div className="skeleton h-7 w-32" /><div className="skeleton h-4 w-44 mt-2" /></div>
        </div>
        <div className="skeleton h-44 rounded-[10px]" />
      </div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><div className="skeleton h-3 w-20" /><div className="skeleton h-[34px] md:h-[42px] w-64 mt-3 rounded-[10px]" /></div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] w-[92px] rounded-[8px]" />)}</div>
        </div>
        <div className="skeleton h-80 mt-12 rounded-[12px] md:ml-[72px]" />
      </div>
    </div>
  );
}
