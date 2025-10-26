export default function DashboardLoading() {
    return (
      <div className="flex h-screen bg-neutral-100 p-4">
        {/* Sidebar Skeleton */}
        <aside className="w-64 border border-neutral-200/20 bg-neutral-50/50 backdrop-blur-md flex flex-col rounded-2xl overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
          {/* Workspace Switcher Skeleton */}
          <div className="p-4 border-b border-neutral-200/20">
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-200 rounded animate-pulse w-3/4" />
                <div className="h-2 bg-neutral-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
          </div>
  
          {/* Navigation Skeleton */}
          <nav className="flex-1 p-3 space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2">
                <div className="w-4 h-4 bg-neutral-200 rounded animate-pulse" />
                <div className="h-3 bg-neutral-200 rounded animate-pulse w-20" />
              </div>
            ))}
          </nav>
  
          {/* User Menu Skeleton */}
          <div className="p-3 border-t border-neutral-200/20">
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-200 animate-pulse shrink-0" />
              <div className="h-3 bg-neutral-200 rounded animate-pulse w-24" />
            </div>
          </div>
        </aside>
        
        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 ml-4">
          {/* Header Skeleton */}
          <header className="h-14 border border-neutral-200/20 bg-white/50 backdrop-blur-md flex items-center justify-between px-6 rounded-2xl mb-4 shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
            <div className="h-5 bg-neutral-200 rounded animate-pulse w-32" />
            <div className="w-9 h-9 bg-neutral-200 rounded-xl animate-pulse" />
          </header>
          
          {/* Content Area Skeleton */}
          <main className="flex-1 overflow-auto p-6 bg-white/50 backdrop-blur-md border border-neutral-200/20 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Skeleton lines */}
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-1/4" />
              <div className="h-4 bg-neutral-200 rounded animate-pulse w-full" />
              <div className="h-4 bg-neutral-200 rounded animate-pulse w-5/6" />
              <div className="h-4 bg-neutral-200 rounded animate-pulse w-4/6" />
              
              <div className="pt-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-neutral-200 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }