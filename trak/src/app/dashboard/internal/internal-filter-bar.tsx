"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export default function InternalFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Get current filter values from URL
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  // Update URL with new filters
  const updateURL = (updates: { search?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or remove parameters
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Preserve sort parameters if they exist
    const sortBy = searchParams.get("sort_by");
    const sortOrder = searchParams.get("sort_order");
    if (sortBy) params.set("sort_by", sortBy);
    if (sortOrder) params.set("sort_order", sortOrder);

    // Use startTransition to trigger server re-fetch
    startTransition(() => {
      router.replace(`/dashboard/internal?${params.toString()}`);
      router.refresh();
    });
  };

  // Debounce search updates to avoid pushing on every keystroke
  React.useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      updateURL({ search, status });
    }, 300);
    setDebounceTimer(timer);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Handle status change
  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateURL({ status: value, search });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    startTransition(() => {
      router.push("/dashboard/internal");
    });
  };

  // Check if any filters are active
  const hasActiveFilters = search || status;

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-[var(--tertiary-foreground)]" />
        <input
          type="text"
          placeholder="Search spaces..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1"
        />
        {isPending && (
          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Status Filter */}
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1"
      >
        <option value="">All Statuses</option>
        <option value="not_started">Draft</option>
        <option value="in_progress">Active</option>
        <option value="complete">Archived</option>
      </select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] rounded-md transition-colors flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

