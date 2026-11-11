export default function Loading() {
  return (
    <div aria-busy aria-label="Kalender wird geladen">
      <div className="skeleton h-4 w-24 mb-6 md:mb-8" />
      <div className="skeleton h-10 md:h-14 w-72 md:w-[28rem]" />
      <div className="skeleton h-4 w-64 mt-4 mb-8 md:mb-10" />
      <div className="skeleton h-3 w-full max-w-lg mb-3" />
      <ul className="divide-y divide-line border-y border-line">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="py-4 md:grid md:grid-cols-[200px_1fr] md:gap-6 md:items-center">
            <div className="mb-2 md:mb-0"><div className="skeleton h-4 w-36" /><div className="skeleton h-3 w-24 mt-2" /></div>
            <div className="skeleton h-[64px] w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
