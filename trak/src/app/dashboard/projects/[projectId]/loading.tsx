export default function ProjectLoading() {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 animate-pulse">
        <div className="max-w-7xl mx-auto p-6">
          {/* Back Button Skeleton */}
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
  
          {/* Header Skeleton */}
          <div className="mb-6">
            {/* Client name */}
            <div className="h-3 w-40 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
            {/* Project name */}
            <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded mb-3" />
            {/* Status & due date */}
            <div className="flex items-center gap-4">
              <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          </div>
  
          {/* Tab Bar Skeleton */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-6">
              <div className="flex gap-6 py-4">
                <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-5 w-28 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            </div>
  
            {/* Content Area Skeleton */}
            <div className="p-6 space-y-4">
              <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-5/6 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-4/6 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 w-full bg-neutral-200 dark:bg-neutral-800 rounded mt-6" />
            </div>
          </div>
        </div>
      </div>
    );
  }