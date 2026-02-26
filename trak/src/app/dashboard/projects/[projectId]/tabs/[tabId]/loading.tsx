export default function TabLoading() {
  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
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

