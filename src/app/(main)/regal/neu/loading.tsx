export default function Loading() {
  return (
    <div aria-busy aria-label="Erfassen wird geladen">
      <header className="mb-8 md:mb-10">
        <div className="skeleton h-10 md:h-14 w-64 md:w-96" />
        <div className="skeleton h-4 w-full max-w-md mt-4" />
      </header>
      <div className="grid md:grid-cols-12 gap-x-12 gap-y-12">
        <div className="md:col-span-7">
          <div className="flex gap-6 border-b border-line pb-2.5 mb-6">
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-14" />
            <div className="skeleton h-4 w-20" />
          </div>
          <div className="skeleton w-full aspect-[4/3]" />
          <div className="skeleton h-11 w-full mt-5" />
        </div>
        <div className="md:col-span-5">
          <div className="border-b border-line pb-2 mb-5"><div className="skeleton h-6 w-36" /></div>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="skeleton h-[60px] w-[40px]" />
              <div className="flex-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3 mt-2" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
