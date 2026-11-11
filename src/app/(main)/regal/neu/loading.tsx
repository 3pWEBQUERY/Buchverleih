export default function Loading() {
  return (
    <div aria-busy aria-label="Erfassen wird geladen">
      <header className="mb-10 md:mb-14">
        <div className="skeleton h-[52px] md:h-[84px] w-64 md:w-[30rem] rounded-[10px]" />
        <div className="skeleton h-4 w-full max-w-md mt-5" />
      </header>
      <div className="grid lg:grid-cols-12 gap-x-10 gap-y-12">
        <div className="lg:col-span-7">
          <div className="skeleton h-12 w-full sm:w-[340px] rounded-full mb-6" />
          <div className="skeleton w-full aspect-[4/3] rounded-[22px]" />
          <div className="skeleton h-12 w-full mt-5 rounded-[10px]" />
        </div>
        <div className="lg:col-span-5">
          <div className="panel !rounded-[18px] p-5">
            <div className="skeleton h-6 w-36" />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4 pt-5">
                <div className="skeleton h-[60px] w-[40px]" />
                <div className="flex-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3 mt-2" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
