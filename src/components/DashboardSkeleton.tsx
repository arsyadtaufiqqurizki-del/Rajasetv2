import Skeleton from './ui/Skeleton';

/** Mirrors the loaded dashboard's shape (3 KPI cards, 2 chart blocks, a trend chart, an 8-row table) to avoid layout shift. */
export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <Skeleton className="h-8 w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5 flex flex-col shadow-sm border border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-9 w-28 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <Skeleton className="h-8 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm flex flex-col">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
        <Skeleton className="h-5 w-56 mb-4" />
        <Skeleton className="h-72 w-full" />
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-outline-variant">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y divide-outline-variant/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-3 pl-5 pr-5">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
