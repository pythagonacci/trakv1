"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, FileText, Paperclip, Search, Square, Table, Upload, User } from "lucide-react";
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
import { uploadFile } from "@/app/actions/file";

type TypeFilter = LinkableType | null;

const TYPE_OPTIONS: Array<{ type: LinkableType; label: string; icon: React.ElementType }> = [
  { type: "person", label: "People", icon: User },
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
  person: "Person",
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
  popoverGap = 2,
  autoFocus = true,
  onQueryChange,
  showUpload = false,
  initialType = null,
  hideInstructions = false,
  popoverSide,
}: {
  isOpen: boolean;
  projectId: string;
  workspaceId: string;
  onSelect: (item: LinkableItem) => Promise<boolean>;
  onClose: () => void;
  initialQuery?: string;
  variant?: "dialog" | "popover";
  anchorRect?: DOMRect | null;
  popoverGap?: number;
  autoFocus?: boolean;
  onQueryChange?: (query: string) => void;
  /** When true, shows "Upload from computer" option for attachment mode */
  showUpload?: boolean;
  /** When set, picker opens with this type pre-selected (e.g. "file" for notes-only). */
  initialType?: LinkableType | null;
  /** When true, hide the "Use ↑/↓ to navigate and Enter to select" footer (e.g. for card comment/notes). */
  hideInstructions?: boolean;
  /** For popover: prefer this side of the anchor. "left" = picker to the left of the trigger (e.g. next to card). */
  popoverSide?: "left" | "right";
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TypeFilter>(null);
  const [results, setResults] = useState<LinkableItem[]>([]);
  const [recentItems, setRecentItems] = useState<LinkableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const [popoverLeft, setPopoverLeft] = useState<number | null>(null);
  const [popoverTop, setPopoverTop] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasValidAnchor =
    !!anchorRect &&
    (anchorRect.top !== 0 ||
      anchorRect.left !== 0 ||
      anchorRect.width !== 0 ||
      anchorRect.height !== 0);

  // Reset state when picker opens
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
    setSelectedType(initialType ?? null);
    setResults([]);
    setActiveIndex(0);
    void loadRecent();
  }, [isOpen, initialType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync search query when initialQuery is updated externally (e.g. typing after @)
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery ?? "");
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const margin = 8;
    const maxWidth = 260;
    const maxHeight = 300;
    const gap = popoverGap;
    const minLeft = margin;
    const maxLeft = window.innerWidth - maxWidth - margin;
    const minTop = margin;
    const maxTop = window.innerHeight - maxHeight - margin;

    // Position: prefer popoverSide when set (e.g. "left" = to the left of card); else prefer right, flip to left if no room
    let left: number;
    if (popoverSide === "left") {
      left = anchorRect.left - maxWidth - gap;
    } else if (popoverSide === "right") {
      left = anchorRect.right + gap;
    } else {
      left = anchorRect.right + gap;
      if (left + maxWidth > window.innerWidth - margin) {
        left = anchorRect.left - maxWidth - gap;
      }
    }
    left = Math.max(minLeft, Math.min(left, maxLeft));

    let top = anchorRect.top;
    top = Math.max(minTop, Math.min(top, maxTop));

    setPopoverLeft(left);
    setPopoverTop(top);
  }, [isOpen, variant, anchorRect, hasValidAnchor, popoverGap, popoverSide]);

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
    const people: LinkableItem[] = [];

    displayItems.forEach((item) => {
      if (item.type === "person") {
        people.push(item);
      } else if (item.isWorkflow) {
        workflow.push(item);
      } else if (item.isCurrentProject) {
        currentProject.push(item);
      } else {
        otherProjects.push(item);
      }
    });

    return { currentProject, otherProjects, workflow, people };
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

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !workspaceId || !projectId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      const result = await uploadFile(formData, workspaceId, projectId);
      if (result.error) {
        console.error("Upload failed:", result.error);
        return;
      }
      if (result.data) {
        const fileItem: LinkableItem = {
          id: result.data.id,
          type: "file",
          name: result.data.file_name || "File",
          location: "Uploaded",
          referenceType: "file",
        };
        const ok = await onSelect(fileItem);
        if (ok) onClose();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <div className={cn("py-1", variant === "popover" ? "space-y-2" : "space-y-3")}>
      {showUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="*/*"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-left transition-colors hover:border-[var(--secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-60",
              variant === "popover" ? "text-xs" : "text-sm"
            )}
          >
            <Upload className={cn("text-[var(--muted-foreground)]", variant === "popover" ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <span className="text-[var(--foreground)]">
              {uploading ? "Uploading…" : "Upload from computer"}
            </span>
          </button>
        </>
      )}
      <div className={cn(
        "flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900",
        variant === "popover" ? "text-xs" : "text-sm"
      )}>
        <Search className={cn("text-neutral-400", variant === "popover" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        <input
          autoFocus={autoFocus}
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search..."
          className={cn(
            "w-full bg-transparent text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100",
            variant === "popover" ? "text-[11px]" : "text-xs"
          )}
        />
      </div>

      {searchQuery.trim().length === 0 && (
        <div>
          <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>Recent</div>
          <div className={cn(variant === "popover" ? "mt-1.5 space-y-1.5" : "mt-2 space-y-2")}>
            {isLoading && recentItems.length === 0 && (
              <div className={cn(
                "rounded-lg border border-dashed border-neutral-200 text-neutral-400 dark:border-neutral-800",
                variant === "popover" ? "px-2.5 py-3 text-[11px]" : "px-3 py-4 text-xs"
              )}>
                Loading recent items...
              </div>
            )}
            {!isLoading && displayItems.length === 0 && (
              <div className={cn(
                "rounded-lg border border-dashed border-neutral-200 text-neutral-400 dark:border-neutral-800",
                variant === "popover" ? "px-2.5 py-3 text-[11px]" : "px-3 py-4 text-xs"
              )}>
                No recent items found for this project.
              </div>
            )}
            {displayItems.map((item, index) => (
              <ResultRow
                key={`${item.type}-${item.id}`}
                item={item}
                isActive={index === activeIndex}
                onSelect={() => handleSelect(item)}
                compact={variant === "popover"}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>Browse by type</div>
        <div className={cn("mt-2 flex flex-wrap", variant === "popover" ? "gap-1.5" : "gap-2")}>
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = selectedType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSelectedType((prev) => (prev === option.type ? null : option.type))}
                className={cn(
                  "flex items-center rounded-full border font-medium transition",
                  variant === "popover" ? "gap-1.5 px-2.5 py-1 text-[11px]" : "gap-2 px-3 py-1.5 text-xs",
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                )}
              >
                <Icon className={variant === "popover" ? "h-3 w-3" : "h-3.5 w-3.5"} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {searchQuery.trim().length > 0 && (
        <div>
          <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>Results</div>
          <div className={cn(variant === "popover" ? "mt-1.5 space-y-2" : "mt-2 space-y-3")}>
            {isLoading && (
              <div className={cn(
                "rounded-lg border border-dashed border-neutral-200 text-neutral-400 dark:border-neutral-800",
                variant === "popover" ? "px-2.5 py-3 text-[11px]" : "px-3 py-4 text-xs"
              )}>
                Searching...
              </div>
            )}
            {!isLoading && displayItems.length === 0 && (
              <div className={cn(
                "rounded-lg border border-dashed border-neutral-200 text-neutral-400 dark:border-neutral-800",
                variant === "popover" ? "px-2.5 py-3 text-[11px]" : "px-3 py-4 text-xs"
              )}>
                No matches found.
              </div>
            )}
            {!isLoading && displayItems.length > 0 && (
              <>
                {groupedByProject.people.length > 0 && (
                  <div className="space-y-2">
                    <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>
                      People
                    </div>
                    {groupedByProject.people.map((item) => {
                      const overallIndex = displayItems.findIndex(
                        (current) => current.id === item.id && current.type === item.type
                      );
                      return (
                        <ResultRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          isActive={overallIndex === activeIndex}
                          onSelect={() => handleSelect(item)}
                          compact={variant === "popover"}
                        />
                      );
                    })}
                  </div>
                )}
                {groupedByProject.currentProject.length > 0 && (
                  <div className="space-y-2">
                    <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>
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
                          compact={variant === "popover"}
                        />
                      );
                    })}
                  </div>
                )}
                {groupedByProject.workflow.length > 0 && (
                  <div className="space-y-2">
                    <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>
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
                          compact={variant === "popover"}
                        />
                      );
                    })}
                  </div>
                )}
                {groupedByProject.otherProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className={cn("font-semibold uppercase tracking-wide text-neutral-400", variant === "popover" ? "text-[10px]" : "text-xs")}>
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
                          compact={variant === "popover"}
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
    if (typeof document === "undefined") return null;
    return createPortal(
      <div
        ref={popoverRef}
        onKeyDown={handleKeyDown}
        className="fixed z-[100000] w-[260px] max-w-[90vw] max-h-[300px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-popover overflow-hidden flex flex-col"
        style={{
          left: popoverLeft ?? anchorRect.left,
          top: popoverTop ?? anchorRect.top,
        }}
      >
        <div className="mb-1.5 text-[11px] font-semibold text-[var(--foreground)]">Add attachment</div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {pickerBody}
        </div>
        <div className={cn("mt-1.5 flex flex-shrink-0 border-t border-[var(--border)] pt-1.5 text-[9px] text-[var(--muted-foreground)]", hideInstructions ? "items-center justify-end" : "items-center justify-between")}>
          {!hideInstructions && <div>Use ↑/↓ to navigate and Enter to select.</div>}
          <Button variant="outline" size="sm" onClick={onClose} className="h-6 px-2 text-[10px]">
            Close
          </Button>
        </div>
      </div>
      ,
      document.body
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
        </DialogHeader>
        {pickerBody}
        <DialogFooter className={cn("flex items-center", hideInstructions ? "justify-end" : "justify-between")}>
          {!hideInstructions && (
            <div className="text-xs text-neutral-400">
              Use ↑/↓ to navigate and Enter to select.
            </div>
          )}
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
  compact = false,
}: {
  item: LinkableItem;
  isActive: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const iconMap: Record<LinkableType, React.ElementType> = {
    doc: FileText,
    table: Table,
    task: CheckSquare,
    file: Paperclip,
    block: Square,
    person: User,
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
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center rounded-lg border text-left transition",
        compact ? "gap-2 px-2.5 py-1.5 text-xs" : "gap-3 px-3 py-2 text-sm",
        isActive
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      )}
    >
      <Icon className={cn("text-neutral-400", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-medium", compact ? "text-[11px]" : "")}>{item.name}</div>
        <div className={cn("truncate text-neutral-400", compact ? "text-[10px]" : "text-xs")}>
          {TYPE_LABELS[item.type]} · {locationText}
        </div>
      </div>
    </button>
  );
}
