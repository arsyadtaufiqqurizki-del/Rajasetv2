import Skeleton from './ui/Skeleton';

/** Mirrors the loaded inventory page's shape (filter bar + 10-row table) to avoid a misleading empty-table flash. */
export default function InventorySkeleton() {
  return (
    <div className="flex flex-col gap-6 flex-1" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading assets…</span>

      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
        <Skeleton className="h-8 w-full" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-outline-variant">
          <Skeleton className="h-4 w-full" />
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
