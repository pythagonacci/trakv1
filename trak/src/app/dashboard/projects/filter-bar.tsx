"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface FilterBarProps {
  clients: Client[];
}

export default function FilterBar({ clients }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Get current filter values from URL
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [clientId, setClientId] = useState(searchParams.get("client_id") || "");

  // Update URL with new filters
  const updateURL = (updates: { search?: string; status?: string; client_id?: string }) => {
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
      router.replace(`/dashboard/projects?${params.toString()}`);
      router.refresh();
    });
  };

  // Debounce search updates to avoid pushing on every keystroke
  React.useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      updateURL({ search, status, client_id: clientId });
    }, 300);
    setDebounceTimer(timer);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Handle status change
  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateURL({ status: value, search, client_id: clientId });
  };

  // Handle client change
  const handleClientChange = (value: string) => {
    setClientId(value);
    updateURL({ client_id: value, search, status });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setClientId("");
    startTransition(() => {
      router.push("/dashboard/projects");
    });
  };

  // Check if any filters are active
  const hasActiveFilters = search || status || clientId;

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Status Filter */}
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
      >
        <option value="">All Statuses</option>
        <option value="not_started">Not Started</option>
        <option value="in_progress">In Progress</option>
        <option value="complete">Complete</option>
      </select>

      {/* Client Filter */}
      <select
        value={clientId}
        onChange={(e) => handleClientChange(e.target.value)}
        className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
      >
        <option value="">All Clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name} {client.company && `(${client.company})`}
          </option>
        ))}
      </select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}