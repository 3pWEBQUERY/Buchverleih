export default function Loading() {
  return (
    <div aria-busy aria-label="Buch wird geladen">
      <div className="skeleton h-4 w-24 mb-6 md:mb-8" />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 md:gap-10 items-end mb-10 md:mb-14">
        <div className="skeleton w-[94px] h-[140px] md:w-[156px] md:h-[232px] rounded-xs" />
        <div>
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-10 md:h-[68px] w-4/5 mt-4 rounded-[10px]" />
          <div className="skeleton h-5 w-40 mt-4" />
          <div className="skeleton h-6 w-32 mt-4 rounded-full" />
        </div>
      </div>
      <div className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel !rounded-[18px] px-5 md:px-8 py-6">
            <div className="skeleton h-6 w-48" />
            {[0, 1].map((k) => (
              <div key={k} className="grid md:grid-cols-[5fr_7fr] gap-x-10 gap-y-3 py-5">
                <div><div className="skeleton h-4 w-32" /><div className="skeleton h-3 w-48 mt-2" /></div>
                <div className="skeleton h-11 w-full rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
