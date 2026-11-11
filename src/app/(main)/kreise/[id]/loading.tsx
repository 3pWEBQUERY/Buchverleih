export default function Loading() {
  return (
    <div aria-busy aria-label="Kreis wird geladen">
      <div className="skeleton h-4 w-16 mb-6 md:mb-8" />
      <header className="mb-10 md:mb-12 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
        <div>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-[52px] md:h-[84px] w-72 md:w-[30rem] mt-4 rounded-[10px]" />
          <div className="flex gap-2 mt-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-6 w-32 rounded-full" />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">{[0, 1].map((i) => <div key={i} className="skeleton h-[92px] w-[124px] rounded-[10px]" />)}</div>
      </header>
      <div className="surface-night rounded-[22px] px-5 md:px-9 py-8">
        <div className="h-10 w-64 rounded bg-night-2" />
        <div className="flex gap-[22px] items-end mt-6" style={{ height: 160 }}>
          {Array.from({ length: 5 }).map((_, k) => <div key={k} className="w-[106px] rounded-[3px] bg-night-2 animate-pulse" style={{ height: 130 + (k % 3) * 10 }} />)}
        </div>
        <div className="h-[3px] bg-night-ink/30" />
      </div>
      <div className="mt-12 grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <div className="lg:col-span-7">
          <div className="skeleton h-7 w-40 mb-6" />
          <div className="panel !rounded-[18px] divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3.5"><div className="skeleton h-10 w-10 rounded-full" /><div><div className="skeleton h-4 w-28" /><div className="skeleton h-3 w-40 mt-2" /></div></div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5"><div className="skeleton h-40 w-full rounded-[18px]" /></div>
      </div>
    </div>
  );
}
