export default function ProjectsLoading() {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Table Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-6 bg-[var(--surface-hover)] rounded animate-pulse w-32" />
          <div className="h-9 bg-[var(--surface-hover)] rounded-xl animate-pulse w-32" />
        </div>
  
        {/* Table Skeleton */}
        <div className="space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-[var(--border)]">
            <div className="h-3 bg-[var(--surface-hover)] rounded animate-pulse w-20" />
            <div className="h-3 bg-[var(--surface-hover)] rounded animate-pulse w-24" />
            <div className="h-3 bg-[var(--surface-hover)] rounded animate-pulse w-16" />
            <div className="h-3 bg-[var(--surface-hover)] rounded animate-pulse w-20" />
          </div>
  
          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-4 py-4 hover:bg-[var(--background)] rounded-xl transition-colors">
              <div className="h-4 bg-[var(--surface-hover)] rounded animate-pulse w-32" />
              <div className="h-4 bg-[var(--surface-hover)] rounded animate-pulse w-40" />
              <div className="h-4 bg-[var(--surface-hover)] rounded animate-pulse w-20" />
              <div className="h-4 bg-[var(--surface-hover)] rounded animate-pulse w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }