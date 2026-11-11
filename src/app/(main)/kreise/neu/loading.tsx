export default function Loading() {
  return (
    <div className="max-w-2xl" aria-busy aria-label="Formular wird geladen">
      <div className="skeleton h-4 w-16 mb-6 md:mb-8" />
      <div className="skeleton h-[52px] md:h-[84px] w-64 md:w-[28rem] rounded-[10px]" />
      <div className="skeleton h-4 w-full mt-5 mb-10 md:mb-14" />
      <div className="panel !rounded-[18px] p-5 md:p-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mb-6 last:mb-0">
            <div className="skeleton h-4 w-28 mb-2" />
            <div className={i === 1 ? "skeleton h-24 w-full rounded-[10px]" : "skeleton h-12 w-full rounded-[10px]"} />
          </div>
        ))}
      </div>
    </div>
  );
}
