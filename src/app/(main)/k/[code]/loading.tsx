export default function Loading() {
  return (
    <div className="min-h-[70vh] grid place-items-center py-2 md:py-8" aria-busy aria-label="Einladung wird geladen">
      <div className="w-full max-w-xl">
        <div className="surface-night rounded-t-[22px] px-6 md:px-10 py-10 flex flex-col items-center">
          <div className="h-[112px] w-64 rounded bg-night-2 animate-pulse" />
          <div className="h-3 w-40 rounded bg-night-2 mt-8" />
          <div className="h-12 w-72 rounded-[10px] bg-night-2 mt-4" />
        </div>
        <div className="panel !rounded-t-none !rounded-b-[22px] !border-t-0 px-6 py-8 flex flex-col items-center">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-[52px] w-48 mt-6 rounded-full" />
        </div>
      </div>
    </div>
  );
}
