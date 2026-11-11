export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10 md:mb-14">
        <div className="skeleton h-[52px] md:h-[84px] w-64 md:w-[420px] rounded-[10px]" />
        <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[92px] sm:w-[118px] rounded-[10px]" />)}
        </div>
      </div>
      <div className="skeleton h-7 w-48 mb-6" />
      <div className="grid md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel flex gap-4 p-4">
            <div className="skeleton h-24 w-16 flex-none" />
            <div className="flex-1">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-6 w-2/3 mt-3" />
              <div className="skeleton h-8 w-40 mt-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
