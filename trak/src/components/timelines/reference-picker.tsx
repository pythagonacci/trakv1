"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, FileText, Paperclip, Search, Square, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getRecentLinkableItems,
  searchLinkableItems,
  type LinkableItem,
  type LinkableType,
} from "@/app/actions/timelines/linkable-actions";

type TypeFilter = LinkableType | null;

const TYPE_OPTIONS: Array<{ type: LinkableType; label: string; icon: React.ElementType }> = [
  { type: "doc", label: "Docs", icon: FileText },
  { type: "table", label: "Tables", icon: Table },
  { type: "task", label: "Tasks", icon: CheckSquare },
  { type: "file", label: "Files", icon: Paperclip },
  { type: "block", label: "Blocks", icon: Square },
];

const TYPE_LABELS: Record<LinkableType, string> = {
  doc: "Doc",
  table: "Table",
  task: "Task",
  file: "File",
  block: "Block",
};

export default function ReferencePicker({
  isOpen,
  projectId,
  workspaceId,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  projectId: string;
  workspaceId: string;
  onSelect: (item: LinkableItem) => Promise<boolean>;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TypeFilter>(null);
  const [results, setResults] = useState<LinkableItem[]>([]);
  const [recentItems, setRecentItems] = useState<LinkableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setSelectedType(null);
    setResults([]);
    setActiveIndex(0);
    void loadRecent();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void runSearch(trimmed);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, selectedType, isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results, recentItems, selectedType, searchQuery]);

  const loadRecent = async () => {
    setIsLoading(true);
    const response = await getRecentLinkableItems({ projectId, workspaceId, limit: 8 });
    if ("data" in response) {
      setRecentItems(response.data);
    }
    setIsLoading(false);
  };

  const runSearch = async (query: string) => {
    setIsLoading(true);
    const response = await searchLinkableItems({
      projectId,
      workspaceId,
      query,
      type: selectedType,
      limit: 50,
    });
    if ("data" in response) {
      setResults(response.data);
    }
    setIsLoading(false);
  };

  const displayItems = useMemo(() => {
    const items = searchQuery.trim().length > 0 ? results : recentItems;
    if (!selectedType) return items;
    return items.filter((item) => item.type === selectedType);
  }, [results, recentItems, searchQuery, selectedType]);

  const groupedItems = useMemo(() => {
    if (selectedType) {
      return { [selectedType]: displayItems };
    }
    return displayItems.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<LinkableType, LinkableItem[]>);
  }, [displayItems, selectedType]);

  const flatItems = useMemo(() => displayItems, [displayItems]);

  const handleSelect = async (item: LinkableItem) => {
    const ok = await onSelect(item);
    if (ok) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) {
        void handleSelect(item);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900">
            <Search className="h-4 w-4 text-neutral-400" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            />
          </div>

          {searchQuery.trim().length === 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent</div>
              <div className="mt-2 space-y-2">
                {isLoading && recentItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400 dark:border-neutral-800">
                    Loading recent items...
                  </div>
                )}
                {!isLoading && displayItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400 dark:border-neutral-800">
                    No recent items found for this project.
                  </div>
                )}
                {displayItems.map((item, index) => (
                  <ResultRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                    isActive={index === activeIndex}
                    onSelect={() => handleSelect(item)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Browse by type</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = selectedType === option.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setSelectedType((prev) => (prev === option.type ? null : option.type))}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      isActive
                        ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {searchQuery.trim().length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Results</div>
              <div className="mt-2 space-y-3">
                {isLoading && (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400 dark:border-neutral-800">
                    Searching...
                  </div>
                )}
                {!isLoading && displayItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400 dark:border-neutral-800">
                    No matches found.
                  </div>
                )}
                {Object.entries(groupedItems).map(([type, items]) => (
                  <div key={type} className="space-y-2">
                    {!selectedType && (
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {TYPE_LABELS[type as LinkableType]}
                      </div>
                    )}
                    {items.map((item, index) => {
                      const overallIndex = displayItems.findIndex(
                        (current) => current.id === item.id && current.type === item.type
                      );
                      return (
                        <ResultRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          isActive={overallIndex === activeIndex}
                          onSelect={() => handleSelect(item)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Use ↑/↓ to navigate and Enter to select.
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  item,
  isActive,
  onSelect,
}: {
  item: LinkableItem;
  isActive: boolean;
  onSelect: () => void;
}) {
  const iconMap: Record<LinkableType, React.ElementType> = {
    doc: FileText,
    table: Table,
    task: CheckSquare,
    file: Paperclip,
    block: Square,
  };
  const Icon = iconMap[item.type];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
        isActive
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      )}
    >
      <Icon className="h-4 w-4 text-neutral-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-xs text-neutral-400">
          {TYPE_LABELS[item.type]} · {item.location}
        </div>
      </div>
    </button>
  );
}
