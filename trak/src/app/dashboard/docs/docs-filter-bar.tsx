"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTransition } from "react";

export default function DocsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [isArchived, setIsArchived] = useState(searchParams.get("is_archived") || "");

  const updateURL = (updates: { search?: string; is_archived?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const sortBy = searchParams.get("sort_by");
    const sortOrder = searchParams.get("sort_order");
    if (sortBy) params.set("sort_by", sortBy);
    if (sortOrder) params.set("sort_order", sortOrder);

    startTransition(() => {
      router.replace(`/dashboard/docs?${params.toString()}`);
      router.refresh();
    });
  };

  React.useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      updateURL({ search, is_archived: isArchived });
    }, 300);
    setDebounceTimer(timer);
    return () => clearTimeout(timer);
  }, [search]);

  const handleArchivedChange = (value: string) => {
    setIsArchived(value);
    updateURL({ is_archived: value, search });
  };

  const handleClearFilters = () => {
    setSearch("");
    setIsArchived("");
    startTransition(() => {
      router.push("/dashboard/docs");
    });
  };

  const hasActiveFilters = search || isArchived;

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-[var(--tertiary-foreground)]" />
        <input
          type="text"
          placeholder="Search docs..."
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

      <select
        value={isArchived}
        onChange={(e) => handleArchivedChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1"
      >
        <option value="">All Docs</option>
        <option value="false">Active</option>
        <option value="true">Archived</option>
      </select>

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

