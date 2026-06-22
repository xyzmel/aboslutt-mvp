export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#DDE6F0] ${className}`} />;
}

export function AuthenticatedPageSkeleton({ titleWidth = "w-56" }: { titleWidth?: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 lg:py-7">
      <div className="rounded-3xl border border-[#DBE4EE] bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className={`mt-3 h-9 ${titleWidth}`} />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <SkeletonBlock className="h-11 w-full sm:w-40" />
          <SkeletonBlock className="h-11 w-full sm:w-40" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock className="h-32" key={index} />
        ))}
      </div>
      <SkeletonBlock className="mt-4 h-48" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock className="h-56" key={index} />
        ))}
      </div>
    </section>
  );
}
