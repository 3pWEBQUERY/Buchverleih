export default function Loading() {
  return (
    <div className="max-w-xl py-6 md:py-10" aria-busy aria-label="Einladung wird geladen">
      <div className="skeleton h-3 w-44" />
      <div className="skeleton h-10 md:h-14 w-72 md:w-[26rem] mt-4" />
      <div className="skeleton h-4 w-full mt-6" />
      <div className="skeleton h-4 w-3/4 mt-2" />
      <div className="mt-10 pt-8 border-t border-line">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-12 w-40 mt-5" />
      </div>
    </div>
  );
}
