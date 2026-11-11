export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt">
      <div className="skeleton h-14 w-64 mb-10" />
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[44px_1fr_auto] gap-4 items-center py-3.5">
            <div className="skeleton h-16 w-11" />
            <div><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/2 mt-2" /></div>
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
