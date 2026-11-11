export default function Loading() {
  return (
    <div aria-busy aria-label="Kreise werden geladen">
      <header className="mb-8 md:mb-10">
        <div className="skeleton h-10 md:h-14 w-40 md:w-56" />
        <div className="skeleton h-4 w-full max-w-xl mt-4" />
      </header>
      <ul className="divide-y divide-line border-y border-line">
        {[0, 1, 2].map((i) => (
          <li key={i} className="py-6">
            <div className="skeleton h-7 w-56" />
            <div className="skeleton h-4 w-full max-w-md mt-3" />
            <div className="skeleton h-3 w-40 mt-3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
