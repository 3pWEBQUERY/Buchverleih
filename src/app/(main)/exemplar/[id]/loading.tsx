/** Platzhalter in der Form der Exemplarseite: Cover-Bühne links, Angaben, Verleiher und Anfrage rechts */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Buch lädt" className="grid md:grid-cols-12 gap-x-10 lg:gap-x-14 gap-y-8">
      <div className="md:col-span-5">
        <div className="panel-quiet rounded-[12px] px-6 py-8 md:px-8 md:py-12 grid place-items-center">
          <div className="skeleton w-[170px] h-[256px] md:w-[220px] md:h-[330px] lg:w-[280px] lg:h-[420px]" />
        </div>
      </div>
      <div className="md:col-span-7 space-y-10">
        <div>
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-[34px] md:h-[46px] w-3/4 mt-4" />
          <div className="skeleton h-5 w-36 mt-5" />
          <div className="flex gap-2 mt-5">{[92, 52, 72].map((w) => <div key={w} className="skeleton h-6 rounded-full" style={{ width: w }} />)}</div>
        </div>
        <div className="panel divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-6 px-5 py-4"><div className="skeleton h-4 w-20" /><div className="skeleton h-4 flex-1 max-w-64" /></div>
          ))}
        </div>
        <div className="panel p-6">
          <div className="flex items-center gap-4"><div className="skeleton h-14 w-14 rounded-full" /><div className="skeleton h-7 w-32" /></div>
          <div className="grid grid-cols-3 gap-6 mt-6 pt-5 border-t border-line">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
        </div>
        <div className="panel rounded-[10px] p-6 md:p-8">
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-20 w-full mt-6" />
          <div className="skeleton h-[52px] w-36 rounded-full mt-8" />
        </div>
      </div>
    </div>
  );
}
