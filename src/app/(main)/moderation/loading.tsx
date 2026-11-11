/** Platzhalter: Titel, Reiter, Zeilen der Warteschlange */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Moderation wird geladen">
      <div className="skeleton h-10 md:h-14 w-1/2 mb-4" />
      <div className="skeleton h-4 w-2/3 max-w-md mb-10" />
      <div className="flex gap-8 border-b border-line pb-3">
        {[90, 80, 60, 55, 70].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: w }} />)}
      </div>
      <div className="mt-10 border-b border-line pb-2 mb-2"><div className="skeleton h-6 w-24" /></div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex justify-between gap-6 py-4 border-b border-line">
          <div className="flex-1"><div className="skeleton h-5 w-1/2 mb-2" /><div className="skeleton h-3.5 w-1/3" /></div>
          <div className="skeleton h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
