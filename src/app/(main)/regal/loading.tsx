export default function Loading() {
  return (
    <div aria-busy aria-label="Regal wird geladen">
      <header className="mb-10 md:mb-12 grid lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-[52px] md:h-[84px] w-64 md:w-[24rem] mt-4 rounded-[10px]" />
        </div>
        <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[92px] lg:w-[124px] rounded-[10px]" />)}</div>
      </header>
      <div className="flex gap-2 mb-6">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 w-32 rounded-full" />)}</div>
      <div className="surface-night rounded-[22px] px-5 md:px-9 py-8">
        {[0, 1].map((i) => (
          <div key={i} className={i ? "mt-10" : ""}>
            <div className="h-7 w-48 rounded bg-night-2" />
            <div className="flex gap-[22px] items-end mt-5" style={{ height: 168 }}>
              {Array.from({ length: i ? 6 : 3 }).map((_, k) => <div key={k} className="w-[110px] rounded-[3px] bg-night-2 animate-pulse" style={{ height: 140 + (k % 3) * 10 }} />)}
            </div>
            <div className="h-[3px] bg-night-ink/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
