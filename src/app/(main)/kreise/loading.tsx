export default function Loading() {
  return (
    <div aria-busy aria-label="Kreise werden geladen">
      <header className="mb-10 md:mb-14">
        <div className="skeleton h-[52px] md:h-[84px] w-48 md:w-72 rounded-[10px]" />
        <div className="skeleton h-4 w-full max-w-xl mt-5" />
      </header>
      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="panel !rounded-[10px] p-5 md:p-7">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-9 w-56 mt-3" />
            <div className="skeleton h-[84px] w-full mt-6 rounded-[12px]" />
            <div className="flex justify-between mt-5"><div className="skeleton h-8 w-28 rounded-full" /><div className="skeleton h-8 w-24" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
