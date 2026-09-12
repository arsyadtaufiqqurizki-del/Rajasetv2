import Skeleton from './ui/Skeleton';

export default function MaintenanceSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading maintenance records…</span>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5 border border-outline-variant bg-surface-container-lowest shadow-sm">
            <Skeleton className="h-4 w-2/3 mb-3" />
            <Skeleton className="h-9 w-1/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="divide-y divide-outline-variant/30">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
