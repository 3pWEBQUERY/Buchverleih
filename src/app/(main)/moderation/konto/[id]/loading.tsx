/** Platzhalter: Name, Zahlenreihe, Vorgänge */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Konto wird geladen">
      <div className="skeleton h-3.5 w-20 mb-8" />
      <div className="skeleton h-3 w-32 mb-4" />
      <div className="skeleton h-10 md:h-14 w-1/3 mb-4" />
      <div className="skeleton h-4 w-1/2 mb-10" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 border-y border-line py-6 mb-12">
        {Array.from({ length: 5 }, (_, i) => <div key={i}><div className="skeleton h-3 w-20 mb-2" /><div className="skeleton h-8 w-12" /></div>)}
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex justify-between gap-6 py-3 border-b border-line max-w-3xl">
          <div className="flex-1"><div className="skeleton h-4 w-1/2 mb-2" /><div className="skeleton h-3 w-1/3" /></div>
          <div className="skeleton h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
