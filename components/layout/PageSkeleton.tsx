// Shown by Next.js automatically while a dashboard page's server component is
// fetching data (via each route's loading.tsx). Without this, navigating
// between dashboard pages showed a blank/frozen screen for however long the
// data fetch took — this gives instant visual feedback instead.
export function PageSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Topbar placeholder */}
      <div className="h-16 border-b border-white/8 px-6 flex items-center justify-between shrink-0">
        <div className="space-y-1.5">
          <div className="h-4 w-32 bg-white/8 rounded" />
          <div className="h-2.5 w-48 bg-white/5 rounded" />
        </div>
        <div className="h-9 w-9 bg-white/8 rounded-full" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-white/8 bg-white/3" />
          ))}
        </div>

        {/* Table / list rows */}
        <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-14 border-b border-white/5 last:border-0 px-4 flex items-center gap-4"
            >
              <div className="h-3 w-3 bg-white/8 rounded-full shrink-0" />
              <div className="h-3 flex-1 bg-white/8 rounded max-w-xs" />
              <div className="h-3 w-20 bg-white/8 rounded shrink-0" />
              <div className="h-3 w-16 bg-white/8 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
