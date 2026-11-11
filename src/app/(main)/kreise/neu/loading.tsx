export default function Loading() {
  return (
    <div className="max-w-xl" aria-busy aria-label="Formular wird geladen">
      <div className="skeleton h-4 w-16 mb-6 md:mb-8" />
      <div className="skeleton h-10 md:h-14 w-64 md:w-96" />
      <div className="skeleton h-4 w-full mt-4 mb-8 md:mb-10" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-6">
          <div className="skeleton h-4 w-28 mb-2" />
          <div className={i === 1 ? "skeleton h-24 w-full" : "skeleton h-11 w-full"} />
        </div>
      ))}
    </div>
  );
}
