export default function Loading() {
  return (
    <div aria-busy aria-label="Buch wird geladen">
      <div className="skeleton h-4 w-24 mb-6 md:mb-8" />
      <div className="grid md:grid-cols-12 gap-x-12 gap-y-8">
        <div className="md:col-span-4">
          <div className="skeleton w-[100px] h-[150px] md:w-[240px] md:h-[360px]" />
        </div>
        <div className="md:col-span-8">
          <div className="skeleton h-10 md:h-14 w-4/5" />
          <div className="skeleton h-5 w-40 mt-4" />
          <div className="skeleton h-4 w-56 mt-5" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-10 pt-8 border-t border-line">
              <div className="skeleton h-6 w-32" />
              <div className="skeleton h-11 w-full mt-5" />
              <div className="skeleton h-4 w-2/3 mt-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
