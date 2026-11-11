export default function Loading() {
  return (
    <div aria-busy aria-label="Erfassen wird geladen">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-[44px] md:h-[64px] w-full max-w-[640px] mt-3 rounded-[10px]" />
      <div className="skeleton h-4 w-full max-w-lg mt-5" />
      <div className="mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-x-10 xl:gap-x-16 gap-y-12">
        <div className="md:pl-[72px]">
          <div className="skeleton h-7 w-64" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[120px] rounded-[10px]" />)}
          </div>
          <div className="skeleton h-7 w-56 mt-14" />
          <div className="skeleton w-full aspect-[4/3] rounded-[12px] mt-6" />
        </div>
        <div className="rounded-[10px] border border-line p-5 self-start">
          <div className="skeleton h-6 w-36" />
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 pt-5">
              <div className="skeleton h-[54px] w-[36px]" />
              <div className="flex-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3 mt-2" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
