export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton h-[44px] md:h-[64px] w-full max-w-[640px] mt-3 rounded-[10px]" />
      <div className="skeleton h-4 w-full max-w-md mt-5" />
      <div className="grid grid-cols-3 gap-2 w-full sm:w-[300px] mt-8">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] rounded-[8px]" />)}
      </div>
      <div className="skeleton h-12 w-full mt-10 rounded-none" />
      <div className="md:pl-[72px] mt-8">
        <div className="skeleton h-7 w-48" />
        <div className="grid xl:grid-cols-2 gap-3 mt-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-[10px] border border-line flex gap-5 p-5">
              <div className="skeleton h-[108px] w-[72px] flex-none" />
              <div className="flex-1">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-6 w-2/3 mt-3" />
                <div className="skeleton h-1 w-full mt-6" />
                <div className="skeleton h-9 w-44 mt-5 rounded-[6px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
