"use client";

import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const INLINE_POPOVER_MAX_HEIGHT = 380;

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

export interface ReferencePickerHandle {
  appendToSearch: (text: string) => void;
  setSearchQuery: (query: string) => void;
  focusSearch: () => void;
  /** Remove last character from search (e.g. when user presses Backspace while capture mode) */
  deleteLastChar: () => void;
}

const ReferencePicker = React.forwardRef<ReferencePickerHandle | null, {
  isOpen: boolean;
  projectId: string;
  workspaceId: string;
  onSelect: (item: LinkableItem) => Promise<boolean>;
  onClose: () => void;
  /** When opening via @, pass the initial query (e.g. first character after @). Further typing can be sent via ref.appendToSearch. */
  initialSearchQuery?: string;
  /** "inline" = popover above caret, "dialog" = modal (default). When inline, user types in place and controlledSearchQuery drives filter. */
  variant?: "dialog" | "inline";
  /** For variant="inline", position of the popover (top-left). Should be above the caret. */
  position?: { top: number; left: number };
  /** When variant="inline", the query is driven by the block (text after @). */
  controlledSearchQuery?: string;
}>(function ReferencePickerInner({
  isOpen,
  projectId,
  workspaceId,
  onSelect,
  onClose,
  initialSearchQuery,
  variant = "dialog",
  position,
  controlledSearchQuery,
}, forwardedRef) {
  const [searchQuery, setSearchQueryState] = useState("");
  const [selectedType, setSelectedType] = useState<TypeFilter>(null);
  const [results, setResults] = useState<LinkableItem[]>([]);
  const [recentItems, setRecentItems] = useState<LinkableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inlinePopoverRef = useRef<HTMLDivElement>(null);

  const isInline = variant === "inline" && position != null;
  const effectiveQuery = isInline && controlledSearchQuery != null ? controlledSearchQuery : searchQuery;

  const setSearchQuery = (value: string) => setSearchQueryState(value);

  useImperativeHandle(
    forwardedRef,
    () => ({
      appendToSearch(text: string) {
        setSearchQueryState((prev) => prev + text);
      },
      setSearchQuery,
      focusSearch() {
        searchInputRef.current?.focus();
      },
      deleteLastChar() {
        setSearchQueryState((prev) => prev.slice(0, -1));
      },
    }),
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    const initial = isInline ? (controlledSearchQuery ?? "") : (initialSearchQuery ?? "");
    setSearchQueryState(initial);
    setSelectedType(null);
    setResults([]);
    setActiveIndex(0);
    void loadRecent();
  }, [isOpen, initialSearchQuery, isInline, controlledSearchQuery]);

  // When opened as dialog, focus search input after mount
  useEffect(() => {
    if (isOpen && !isInline && searchInputRef.current) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, isInline]);

  // Click outside to close when inline (bubble phase so result row onClick runs first)
  useEffect(() => {
    if (!isOpen || !isInline) return;
    const handleClick = (e: MouseEvent) => {
      const el = inlinePopoverRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("click", handleClick, false);
    return () => document.removeEventListener("click", handleClick, false);
  }, [isOpen, isInline, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = effectiveQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void runSearch(trimmed);
    }, 300);

    return () => clearTimeout(timeout);
  }, [effectiveQuery, selectedType, isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results, recentItems, selectedType, effectiveQuery]);

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
    const items = effectiveQuery.trim().length > 0 ? results : recentItems;
    if (!selectedType) return items;
    return items.filter((item) => item.type === selectedType);
  }, [results, recentItems, effectiveQuery, selectedType]);

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

  const handleSelect = async (item: LinkableItem) => {
    const ok = await onSelect(item);
    if (ok) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
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

  const pickerContent = (
    <>
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          {isInline ? (
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
              {effectiveQuery ? `Filter: ${effectiveQuery}` : "Type after @ to filter..."}
            </span>
          ) : (
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQueryState(event.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            />
          )}
        </div>

        {effectiveQuery.trim().length === 0 && (
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

          {effectiveQuery.trim().length > 0 && (
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
                    {/* Current Project Items */}
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
                    {/* Workflow Items */}
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
                    {/* Other Projects Items */}
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

        {!isInline && (
          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">
              Use ↑/↓ to navigate and Enter to select.
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
    </>
  );

  if (isInline && isOpen && position) {
    return createPortal(
      <div
        ref={inlinePopoverRef}
        role="dialog"
        aria-label="Add attachment"
        className="z-[99999] w-[min(400px,calc(100vw-24px))] max-h-[min(380px,60vh)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg flex flex-col"
        style={{
          position: "fixed",
          top: Math.max(8, position.top - INLINE_POPOVER_MAX_HEIGHT - 8),
          left: Math.max(8, Math.min(position.left, typeof window !== "undefined" ? window.innerWidth - 416 : position.left)),
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="border-b border-[var(--border)] px-3 py-2">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">Add attachment</div>
          <div className="text-[11px] text-[var(--tertiary-foreground)] mt-0.5">↑/↓ navigate · Enter select · Esc close</div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-3">
          {pickerContent}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
        </DialogHeader>
        {pickerContent}
      </DialogContent>
    </Dialog>
  );
});

ReferencePicker.displayName = "ReferencePicker";

export default ReferencePicker;

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
