export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt">
      <div className="skeleton h-4 w-28 mb-8" />
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-x-10 xl:gap-x-16 gap-y-8 items-start">
        <div className="space-y-5">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="skeleton h-[156px] lg:h-[396px] rounded-[12px]" />
            <div><div className="skeleton h-7 w-3/4" /><div className="skeleton h-4 w-1/3 mt-3" /></div>
          </div>
          <div className="skeleton h-40 rounded-[10px]" />
        </div>
        <div className="min-w-0">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-[40px] md:h-[100px] w-4/5 mt-3 rounded-[10px]" />
          <div className="skeleton h-24 mt-8 rounded-[10px]" />
          <div className="skeleton h-64 mt-4 rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}
