export default function Loading() {
  return (
    <div aria-busy aria-label="Kalender wird geladen">
      <div className="skeleton h-4 w-24 mb-6 md:mb-8" />
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-[34px] md:h-[46px] w-72 md:w-[36rem] max-w-full mt-3 rounded-[10px]" />
      <div className="skeleton h-4 w-full max-w-lg mt-4" />
      <div className="grid grid-cols-3 gap-2 w-full sm:w-[300px] mt-8">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] rounded-[8px]" />)}</div>
      <div className="md:pl-[72px] mt-12">
        <div className="skeleton h-7 w-40" />
        <div className="rounded-[10px] border border-line mt-6 divide-y divide-line">
          <div className="skeleton h-[76px] rounded-none" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-4 md:grid md:grid-cols-[240px_1fr] md:gap-6 md:items-center">
              <div className="mb-3 md:mb-0 flex items-center gap-3"><div className="skeleton h-12 w-8" /><div className="flex-1"><div className="skeleton h-4 w-36" /><div className="skeleton h-3 w-24 mt-2" /></div></div>
              <div className="skeleton h-9 w-full rounded-[8px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
