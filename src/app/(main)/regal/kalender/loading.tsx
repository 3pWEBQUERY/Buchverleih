export default function Loading() {
  return (
    <div aria-busy aria-label="Kalender wird geladen">
      <div className="skeleton h-4 w-24 mb-6 md:mb-8" />
      <div className="skeleton h-[52px] md:h-[84px] w-72 md:w-[34rem] rounded-[10px]" />
      <div className="skeleton h-4 w-64 mt-5 mb-10 md:mb-14" />
      <div className="flex gap-2 mb-5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-6 w-24 rounded-full" />)}</div>
      <ul className="panel !rounded-[18px] divide-y divide-line">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="px-4 md:px-6 py-5 md:grid md:grid-cols-[240px_1fr] md:gap-8 md:items-center">
            <div className="mb-3 md:mb-0 flex items-center gap-3.5"><div className="skeleton h-14 w-10" /><div className="flex-1"><div className="skeleton h-4 w-36" /><div className="skeleton h-3 w-24 mt-2" /></div></div>
            <div className="skeleton h-[64px] w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
