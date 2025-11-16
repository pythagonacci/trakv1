export default function TabLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Header Skeleton */}
        <div className="pt-4 pb-2">
          <div className="h-8 bg-[var(--surface)] rounded animate-pulse w-64" />
        </div>

        {/* Tab Bar Skeleton */}
        <div className="border-b border-[var(--border)]">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-[var(--surface)] rounded-t animate-pulse w-24" />
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="py-3 md:py-4 lg:py-5 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[var(--surface)] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

