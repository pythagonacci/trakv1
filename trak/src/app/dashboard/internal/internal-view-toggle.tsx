"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

interface InternalViewToggleProps {
  currentView: "list" | "grid";
}

export default function InternalViewToggle({ currentView }: InternalViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = () => {
    const params = new URLSearchParams(searchParams.toString());
    const newView = currentView === "list" ? "grid" : "list";

    if (newView === "grid") {
      // Grid is the default, so remove the param to keep URL clean
      params.delete("view");
    } else {
      params.set("view", newView);
    }

    router.push(`/dashboard/internal?${params.toString()}`);
  };

  return (
    <button
      onClick={handleViewChange}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[2px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
      title={currentView === "list" ? "Grid view" : "List view"}
    >
      {currentView === "list" ? (
        <>
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Grid</span>
        </>
      ) : (
        <>
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">List</span>
        </>
      )}
    </button>
  );
}

