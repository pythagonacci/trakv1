"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  initialQuery = "",
  variant = "dialog",
  anchorRect = null,
  autoFocus = true,
  onQueryChange,
}: {
  isOpen: boolean;
  projectId: string;
  workspaceId: string;
  onSelect: (item: LinkableItem) => Promise<boolean>;
  onClose: () => void;
  initialQuery?: string;
  variant?: "dialog" | "popover";
  anchorRect?: DOMRect | null;
  autoFocus?: boolean;
  onQueryChange?: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TypeFilter>(null);
  const [results, setResults] = useState<LinkableItem[]>([]);
  const [recentItems, setRecentItems] = useState<LinkableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const [popoverPlacement] = useState<"top" | "bottom">("top");
  const [popoverLeft, setPopoverLeft] = useState<number | null>(null);
  const [popoverTop, setPopoverTop] = useState<number | null>(null);
  const hasValidAnchor =
    !!anchorRect &&
    (anchorRect.top !== 0 ||
      anchorRect.left !== 0 ||
      anchorRect.width !== 0 ||
      anchorRect.height !== 0);

  useEffect(() => {
    if (!isOpen) return;
    if (variant === "popover") {
      const active = document.activeElement;
      if (active && active instanceof HTMLElement) {
        lastActiveElementRef.current = active;
      }
      requestAnimationFrame(() => {
        lastActiveElementRef.current?.focus();
      });
    }
    setSearchQuery(initialQuery || "");
    setSelectedType(null);
    setResults([]);
    setActiveIndex(0);
    void loadRecent();
  }, [isOpen, initialQuery]);

  // Update search query when initialQuery changes (even after mount, for syncing from external source)
  useEffect(() => {
    if (isOpen && initialQuery !== undefined) {
      setSearchQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen || variant !== "popover") return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!popoverRef.current || !target) return;
      if (!popoverRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, variant, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || variant !== "popover" || !hasValidAnchor || !anchorRect) return;
    const margin = 6;
    const maxWidth = 320;
    const maxHeight = 400;
    const gap = 8; // Gap between caret and popover
    
    // Position horizontally aligned with the caret
    const left = Math.min(Math.max(anchorRect.left - 12, margin), window.innerWidth - maxWidth - margin);
    
    // Position above the caret - place popover bottom edge just above the caret top
    // We estimate the popover height and position it accordingly
    const estimatedPopoverHeight = Math.min(maxHeight, 300); // Estimate based on content
    const top = Math.max(margin, anchorRect.top - estimatedPopoverHeight - gap);

    setPopoverLeft(left);
    setPopoverTop(top);
  }, [isOpen, variant, anchorRect, hasValidAnchor]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    // Show instant filtered results from recent items for immediate feedback
    const filteredRecent = recentItems.filter((item) => {
      const matchesQuery = item.name.toLowerCase().includes(trimmed.toLowerCase());
      if (!selectedType) return matchesQuery;
      return matchesQuery && item.type === selectedType;
    });
    if (filteredRecent.length > 0) {
      setResults(filteredRecent);
    }

    // Reduced debounce for faster feedback, especially for inline mentions
    // Very short queries (< 2 chars) get faster response for immediate feedback
    const queryLength = trimmed.length;
    let debounceDelay = variant === "popover" ? 100 : 150;
    if (queryLength <= 2) {
      debounceDelay = variant === "popover" ? 50 : 100;
    }

    const timeout = setTimeout(() => {
      void runSearch(trimmed);
    }, debounceDelay);

    return () => clearTimeout(timeout);
  }, [searchQuery, selectedType, isOpen, variant, recentItems]);

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

  const groupedByProject = useMemo(() => {
    const currentProject: LinkableItem[] = [];
    const otherProjects: LinkableItem[] = [];
    const workflow: LinkableItem[] = [];

    displayItems.forEach((item) => {
      if (item.isWorkflow) {
        workflow.push(item);
      } else if (item.isCurrentProject) {
        currentProject.push(item);
      } else {
        otherProjects.push(item);
      }
    });

    return { currentProject, otherProjects, workflow };
  }, [displayItems]);

  const flatItems = useMemo(() => displayItems, [displayItems]);

  useEffect(() => {
    if (!isOpen || variant !== "popover") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // If the popover input is focused, let it handle input normally
      if (popoverRef.current && target && popoverRef.current.contains(target)) return;
      if (!target) return;
      const tagName = target.tagName;
      const isEditable =
        target.isContentEditable ||
        !!target.closest('[contenteditable="true"]') ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA";
      if (!isEditable) return;

      // Only handle navigation and selection keys, not typing
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % (flatItems.length || 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = flatItems[activeIndex];
        if (item) {
          void handleSelect(item);
        }
        return;
      }

      // Don't capture typing - let the user type normally in their input field
      // The search query will be synced via onQueryChange callback
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, variant, onClose, flatItems, activeIndex]);

  // Sync search query changes back to parent
  useEffect(() => {
    if (onQueryChange) {
      onQueryChange(searchQuery);
    }
  }, [searchQuery, onQueryChange]);

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

  const pickerBody = (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900">
        <Search className="h-3.5 w-3.5 text-neutral-400" />
        <input
          autoFocus={autoFocus}
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search..."
          className="w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
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
            {!isLoading && displayItems.length > 0 && (
              <>
                {groupedByProject.currentProject.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      This Project
                    </div>
                    {groupedByProject.currentProject.map((item) => {
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
                )}
                {groupedByProject.workflow.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Workflow Pages
                    </div>
                    {groupedByProject.workflow.map((item) => {
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
                )}
                {groupedByProject.otherProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Other Projects
                    </div>
                    {groupedByProject.otherProjects.map((item) => {
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
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === "popover" && hasValidAnchor && anchorRect) {
    if (!isOpen) return null;
    return (
      <div
        ref={popoverRef}
        onKeyDown={handleKeyDown}
        className="fixed z-[100000] w-[320px] max-w-[90vw] max-h-[400px] rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col"
        style={{
          left: popoverLeft ?? anchorRect.left,
          top: popoverTop ?? anchorRect.top,
        }}
      >
        <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-2">Add attachment</div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {pickerBody}
        </div>
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400 flex-shrink-0">
          <div>Use ↑/↓ to navigate and Enter to select.</div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-6 text-xs px-2">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
        </DialogHeader>
        {pickerBody}
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

  const locationText = item.isWorkflow
    ? `Workflow · ${item.location}`
    : !item.isCurrentProject && item.projectName
    ? `${item.projectName} · ${item.location}`
    : item.location;

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
          {TYPE_LABELS[item.type]} · {locationText}
        </div>
      </div>
    </button>
  );
}
