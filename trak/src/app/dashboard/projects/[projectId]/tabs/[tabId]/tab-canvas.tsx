"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Block, deleteBlock, updateBlock, createBlock } from "@/app/actions/block";
import EmptyCanvasState from "./empty-canvas-state";
import AddBlockButton from "./add-block-button";
import BlockRenderer from "./block-renderer";
import DocSidebar from "./doc-sidebar";
import { cn } from "@/lib/utils";
import { TAB_THEMES } from "./tab-themes";

interface TabCanvasProps {
  tabId: string;
  projectId: string;
  workspaceId: string;
  blocks: Block[];
  scrollToTaskId?: string | null;
  onThemeChange?: (theme: string) => void;
  currentTheme?: string;
}

interface BlockRow {
  rowIndex: number;
  blocks: Block[];
  maxColumns: number; // 1, 2, or 3 - how many columns this row has
}

export default function TabCanvas({ tabId, projectId, workspaceId, blocks: initialBlocks, scrollToTaskId, onThemeChange, currentTheme: propTheme }: TabCanvasProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [newBlockIds, setNewBlockIds] = useState<Set<string>>(new Set());
  const [tabTheme, setTabTheme] = useState<string>(propTheme || "default");
  
  // 🚀 Sync blocks from server only when tabId changes
  // Don't reset on every server re-fetch caused by our own edits
  // Blocks are initialized from initialBlocks via useState above
  const prevTabIdRef = useRef(tabId);
  const justDraggedRef = useRef(false);
  const lastDragTimeRef = useRef<number>(0);
  const recentlyDraggedBlocksRef = useRef<Map<string, Block>>(new Map());
  
  useEffect(() => {
    // Only sync from the server when the tab itself actually changes.
    // While you stay on the same tab, the client state is the source of truth.
    if (prevTabIdRef.current !== tabId) {
      prevTabIdRef.current = tabId;
      setBlocks(initialBlocks);
      justDraggedRef.current = false;
      lastDragTimeRef.current = 0;
    }
  }, [tabId, initialBlocks]);

  // Configure sensors for drag and drop (mouse/touch only to avoid capturing typing keys)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
  );

  // Organize blocks into rows
  // Blocks in the same row are side-by-side (have different column values but similar positions)
  // Blocks in different rows are stacked vertically
  const blockRows = useMemo(() => {
    if (blocks.length === 0) return [];

    // Filter out any blocks with invalid positions and log them
    const validBlocks = blocks.filter((block) => {
      const isValid = typeof block.position === 'number' && isFinite(block.position) && block.position >= 0;
      if (!isValid) {
        console.warn("Block with invalid position found:", {
          id: block.id,
          position: block.position,
          type: typeof block.position,
          block: block
        });
      }
      return isValid;
    });

    // If we filtered out any blocks, log a warning
    if (validBlocks.length < blocks.length) {
      console.error(`Lost ${blocks.length - validBlocks.length} blocks due to invalid positions. Total blocks: ${blocks.length}, Valid blocks: ${validBlocks.length}`);
    }

    // Sort blocks by position (vertical order)
    const sortedBlocks = [...validBlocks].sort((a, b) => a.position - b.position);

    // Group blocks into rows
    // Blocks that are side-by-side have the same "row_index" (rounded position)
    // We use position rounded to nearest integer to determine rows
    const rowsMap = new Map<number, Block[]>();

    sortedBlocks.forEach((block) => {
      // Position is now an integer representing the row index
      const rowIndex = Math.floor(block.position); // Floor is safe for integers, but keeps it robust
      const col = block.column !== undefined && block.column >= 0 && block.column <= 2 ? block.column : 0;
      
      if (!rowsMap.has(rowIndex)) {
        rowsMap.set(rowIndex, []);
      }
      
      // Find insertion point to maintain column order within row
      const rowBlocks = rowsMap.get(rowIndex)!;
      const insertIndex = rowBlocks.findIndex(b => {
        const bCol = b.column !== undefined && b.column >= 0 && b.column <= 2 ? b.column : 0;
        return bCol > col;
      });
      
      if (insertIndex === -1) {
        rowBlocks.push(block);
      } else {
        rowBlocks.splice(insertIndex, 0, block);
      }
    });

    // Convert to array of BlockRow objects
    const rows: BlockRow[] = Array.from(rowsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([rowIndex, rowBlocks]) => {
        const blockCount = rowBlocks.length;

        // Normalize columns to pack left-to-right with no gaps (prevents "ghost" columns after deletions)
        const normalizedBlocks = rowBlocks.map((block, idx) => ({
          ...block,
          column: idx,
        }));

        // Single block rows should always render full width
        if (blockCount === 1) {
          const onlyBlock = normalizedBlocks[0];
          return {
            rowIndex,
            blocks: [{ ...onlyBlock, column: 0 }],
            maxColumns: 1,
          };
        }

        // Multi-block rows: cap at 3, but never below the number of blocks present
        const maxColumns = Math.max(1, Math.min(3, blockCount));

        return {
          rowIndex,
          blocks: normalizedBlocks,
          maxColumns,
        };
      });

    return rows;
  }, [blocks]);

  const handleUpdate = (updatedBlock?: Block) => {
    if (updatedBlock) {
      // Update local state with the updated block (no router.refresh for inline edits)
      setBlocks(prev =>
        prev.map(b => (b.id === updatedBlock.id ? updatedBlock : b))
      );
    } else {
      // Fallback: refresh only when no block provided (for errors or structural changes)
      router.refresh();
    }
  };

  const handleDelete = async (blockId: string) => {
    const result = await deleteBlock(blockId);
    if (result.error) {
      console.error("Failed to delete block:", result.error);
      alert(`Error deleting block: ${result.error}`);
      return;
    }
    router.refresh();
  };

  const handleConvert = async (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "image" | "video" | "embed" | "pdf" | "section" | "doc_reference") => {
    // Determine default content for the new type
    let newContent: Record<string, unknown> = {};
    if (newType === "text") {
      newContent = { text: "" };
    } else if (newType === "task") {
      newContent = { title: "New Task List", tasks: [] };
    } else if (newType === "link") {
      newContent = { title: "", url: "", description: "" };
    } else if (newType === "divider") {
      newContent = {};
    } else if (newType === "table") {
      newContent = {
        rows: 3,
        cols: 3,
        cells: [
          ["", "", ""],
          ["", "", ""],
          ["", "", ""],
        ],
        columnWidths: [150, 150, 150],
      };
    } else if (newType === "timeline") {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);
      newContent = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        events: [],
      };
    } else if (newType === "file") {
      newContent = { files: [] };
    } else if (newType === "image") {
      newContent = { fileId: null, caption: "", width: 400 };
    } else if (newType === "video") {
      newContent = { files: [] };
    } else if (newType === "embed") {
      newContent = { url: "", displayMode: "inline" };
    } else if (newType === "pdf") {
      newContent = { fileId: null };
    } else if (newType === "section") {
      newContent = { height: 400 };
    } else if (newType === "doc_reference") {
      newContent = { doc_id: "", doc_title: "" };
    }

    const result = await updateBlock({
      blockId,
      type: newType,
      content: newContent,
    });

    if (result.error) {
      console.error("Failed to convert block:", result.error);
      alert(`Error converting block: ${result.error}`);
      return;
    }
    router.refresh();
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    console.log("Drag started for block:", event.active.id);
    setIsDragging(true);
    const block = blocks.find((b) => b.id === event.active.id);
    setDraggedBlock(block || null);
  };

  // Handle drag end - reorder blocks or move between rows/columns
  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      setIsDragging(false);

    // Allow dropping on the same block (no change needed)
    if (!over || active.id === over.id) {
      console.log("No valid drop target or dropped on same block, cancelling drag");
      setDraggedBlock(null);
      return;
    }

    // Get the dragged block fresh from the current blocks array using active.id
    const draggedBlockId = active.id as string;
    const draggedBlock = blocks.find((b) => b.id === draggedBlockId);

    if (!draggedBlock) {
      console.error("Dragged block not found in blocks array. Active ID:", draggedBlockId, "Available block IDs:", blocks.map(b => b.id));
      setDraggedBlock(null);
      return;
    }

    // Validate dragged block has an ID
    if (!draggedBlock.id) {
      console.error("Dragged block has no ID:", draggedBlock);
      setDraggedBlock(null);
      return;
    }

    console.log("Found dragged block:", draggedBlock.id, "Type:", draggedBlock.type, "Position:", draggedBlock.position, "Column:", draggedBlock.column);

    // Try to find the over block
    let overBlock = blocks.find((b) => b.id === over.id);
    console.log("Looking for over block:", over.id, "Found:", overBlock ? `${overBlock.id} (pos: ${overBlock.position}, col: ${overBlock.column})` : "not found");

    // Determine drag type based on overBlock position (if found)
    if (overBlock) {
      const isSameRow = Math.floor(draggedBlock.position) === Math.floor(overBlock.position);
      const isSameColumn = draggedBlock.column === overBlock.column;
      console.log("Drag analysis:", { isSameRow, isSameColumn, draggedPos: draggedBlock.position, overPos: overBlock.position, draggedCol: draggedBlock.column, overCol: overBlock.column });
    }

    if (!overBlock) {
      console.warn("Over target not found in blocks array. Over ID:", over.id, "Available block IDs:", blocks.map(b => b.id));

      // Place dragged block at the end of the canvas
      const maxPosition = Math.max(
        ...blocks.map(b => Math.floor(b.position)),
        -1
      );
      const newPosition = maxPosition + 1;
      const newCol = 0;

      const updatedBlocks = blocks.map(block =>
        block.id === draggedBlock.id
          ? { ...block, column: newCol, position: newPosition }
          : block
      );

      if (updatedBlocks.length !== blocks.length) {
        console.error("Block count mismatch when placing at end!");
        setDraggedBlock(null);
        return;
      }

      setBlocks(updatedBlocks);
      justDraggedRef.current = true;
      lastDragTimeRef.current = Date.now();

      if (!draggedBlock.id.startsWith("temp-")) {
        try {
          await updateBlock({
            blockId: draggedBlock.id.trim(),
            column: newCol,
            position: newPosition,
          });
        } catch (error) {
          console.error("Failed to update block position:", error);
          setBlocks(blocks); // revert
        }
      }

      setDraggedBlock(null);
      return;
    }
    
    // Validate over block has an ID
    if (!overBlock.id) {
      console.error("Over block has no ID:", overBlock);
      setDraggedBlock(null);
      return;
    }

    const overRowIndex = Math.floor(overBlock.position);
    const overCol = overBlock.column !== undefined && overBlock.column >= 0 && overBlock.column <= 2 ? overBlock.column : 0;

    const isTempId = (id: string) => id.startsWith("temp-");

    // If user dragged downward significantly on the same row, create a new row below
    const sourceRowIndex = Math.floor(draggedBlock.position);
    if (overRowIndex === sourceRowIndex && event.delta.y > 40) {
      const insertionRow = overRowIndex + 1;
      const updatedBlocks = blocks.map((block) => {
        if (block.id === draggedBlock.id) {
          return { ...block, position: insertionRow, column: 0 };
        }
        const blockRow = Math.floor(block.position);
        if (blockRow >= insertionRow) {
          return { ...block, position: blockRow + 1 };
        }
        return block;
      });

      setBlocks(updatedBlocks);
      justDraggedRef.current = true;
      lastDragTimeRef.current = Date.now();

      // Persist position changes for affected blocks
      try {
        const changedBlocks = updatedBlocks.filter((block) => {
          const original = blocks.find((b) => b.id === block.id);
          if (!original) return false;
          return (
            Math.floor(original.position) !== Math.floor(block.position) ||
            original.column !== block.column
          );
        });

        const persistentBlocks = changedBlocks.filter(
          (block) => block.id && !isTempId(block.id),
        );

        if (persistentBlocks.length > 0) {
          await Promise.all(
            persistentBlocks.map((block) =>
              updateBlock({
                blockId: block.id.trim(),
                position: Math.floor(block.position),
                column:
                  block.column !== undefined &&
                  block.column >= 0 &&
                  block.column <= 2
                    ? block.column
                    : 0,
              }),
            ),
          );
        }
      } catch (error) {
        console.error("Error updating block when creating new row:", error);
      } finally {
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 2000);
      }

      setDraggedBlock(null);
      return;
    }

    // Find the target row
    const targetRow = blockRows.find(r => r.rowIndex === overRowIndex);
    if (!targetRow) {
      console.error("Target row not found for rowIndex:", overRowIndex, "Available rows:", blockRows.map(r => r.rowIndex));
      setDraggedBlock(null);
      return;
    }

    // Normalize columns to pack left-to-right with a max of 3 per row
    const normalizeRow = (rowBlocks: Block[], rowIndex: number): Block[] => {
      const sorted = [...rowBlocks].sort((a, b) => {
        const colA =
          a.column !== undefined && a.column >= 0 && a.column <= 2 ? a.column : 0;
        const colB =
          b.column !== undefined && b.column >= 0 && b.column <= 2 ? b.column : 0;
        return colA - colB;
      });

      return sorted.slice(0, 3).map((block, idx) => ({
        ...block,
        column: idx,
        position: rowIndex,
      }));
    };

    const targetRowBlocks = targetRow.blocks.filter(
      (b) => b.id !== draggedBlock.id,
    );

    // Build the target row composition with the dragged block included
    const targetRowWithDragged = normalizeRow(
      [
        ...targetRowBlocks,
        { ...draggedBlock, column: 0, position: overRowIndex },
      ],
      overRowIndex,
    );

    // If moving between rows, normalize the source row to close gaps
    const sourceRowNormalized =
      sourceRowIndex !== overRowIndex
        ? (() => {
            const sourceRow = blockRows.find((r) => r.rowIndex === sourceRowIndex);
            if (!sourceRow) return null;
            const remaining = sourceRow.blocks.filter(
              (b) => b.id !== draggedBlock.id,
            );
            return normalizeRow(remaining, sourceRowIndex);
          })()
        : null;

    // Apply updates to blocks in the affected rows
    const updatedBlocks = blocks.map((block) => {
      const targetReplacement = targetRowWithDragged.find(
        (b) => b.id === block.id,
      );
      if (targetReplacement) return targetReplacement;

      if (sourceRowNormalized) {
        const sourceReplacement = sourceRowNormalized.find(
          (b) => b.id === block.id,
        );
        if (sourceReplacement) return sourceReplacement;
      }

      return block;
    });

    // Safety check: ensure all blocks are preserved
    if (updatedBlocks.length !== blocks.length) {
      console.error("Block count mismatch after drag update!", {
        originalCount: blocks.length,
        updatedCount: updatedBlocks.length,
        originalIds: blocks.map((b) => b.id),
        updatedIds: updatedBlocks.map((b) => b.id),
        missingIds: blocks
          .filter((b) => !updatedBlocks.find((ub) => ub.id === b.id))
          .map((b) => b.id),
      });
      setDraggedBlock(null);
      return;
    }

    setBlocks(updatedBlocks);
    justDraggedRef.current = true;
    lastDragTimeRef.current = Date.now();

    // Persist changed blocks (column/row updates only) without overwriting optimistic state
    try {
      if (!draggedBlock.id) {
        throw new Error("Dragged block has no ID");
      }

      const changedBlocks = updatedBlocks.filter((block) => {
        const original = blocks.find((b) => b.id === block.id);
        if (!original) return false;
        return (
          original.column !== block.column ||
          Math.floor(original.position) !== Math.floor(block.position)
        );
      });

      const persistentBlocks = changedBlocks.filter(
        (block) => block.id && !isTempId(block.id),
      );

      if (persistentBlocks.length > 0) {
        const results = await Promise.all(
          persistentBlocks.map((block) =>
            updateBlock({
              blockId: block.id.trim(),
              column:
                block.column !== undefined &&
                block.column >= 0 &&
                block.column <= 2
                  ? block.column
                  : 0,
              position: Math.floor(block.position),
            }),
          ),
        );
        const failed = results.filter((r) => r?.error);
        if (failed.length > 0) {
          console.error(
            "Some block updates failed:",
            failed.map((f) => f.error).join(", "),
          );
        }
      }
    } catch (error) {
      console.error("Error updating block after drag:", error);
    } finally {
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 2000);
    }

    setDraggedBlock(null);
    } catch (error) {
      console.error("CRITICAL ERROR in handleDragEnd:", error);
      console.error("Error details:", {
        error: error,
        stack: error instanceof Error ? error.stack : 'No stack',
        activeId: event.active?.id,
        overId: event.over?.id
      });
      // Reset drag state on error
      setDraggedBlock(null);
      setIsDragging(false);
    }
  };

  // Note: We removed the useEffect that was resetting blocks from initialBlocks
  // This prevents overwriting local state from our own inline edits
  // Blocks are only synced when tabId changes (handled in the first useEffect above)

  // Only mount DnD on client to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theme persistence (localStorage, per tab)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
    if (saved && TAB_THEMES.some((t) => t.id === saved)) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Listen for theme changes from project header
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleCustomChange = () => {
      const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
      if (saved && TAB_THEMES.some((t) => t.id === saved) && saved !== tabTheme) {
        setTabTheme(saved);
      }
    };
    window.addEventListener("tab-theme-updated", handleCustomChange);
    return () => window.removeEventListener("tab-theme-updated", handleCustomChange);
  }, [tabId, tabTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`trak-tab-theme-${tabId}`, tabTheme);
    onThemeChange?.(tabTheme);
  }, [tabTheme, tabId, onThemeChange]);

  const currentTheme = useMemo(
    () => TAB_THEMES.find((t) => t.id === tabTheme) || TAB_THEMES[0],
    [tabTheme]
  );

  const hasBlocks = blocks.length > 0;
  const getNextPosition = () => {
    if (blocks.length === 0) return 0;
    const maxPos = Math.max(...blocks.map((b) => Math.floor(b.position)));
    return maxPos + 1;
  };

  const resolveOptimisticBlock = React.useCallback((tempId: string, savedBlock: Block) => {
    setBlocks((prevBlocks) => {
      let replaced = false;
      const updated = prevBlocks.map((block) => {
        if (block.id === tempId) {
          replaced = true;
          return {
            ...savedBlock,
            position: block.position ?? savedBlock.position ?? getNextPosition(),
            column: block.column ?? savedBlock.column ?? 0,
          };
        }
        return block;
      });
      return replaced ? updated : prevBlocks;
    });

    setNewBlockIds((prev) => {
      const next = new Set(prev);
      if (next.delete(tempId)) {
        next.add(savedBlock.id);
      }
      return next;
    });
  }, [getNextPosition]);

  // Handle optimistic block creation
  const handleBlockCreated = (newBlock: Block) => {
    // Immediately add the new block to local state (optimistic update)
    // Prevent duplicates by checking if block already exists
    setBlocks((prevBlocks) => {
      // Check if block with this ID already exists
      if (prevBlocks.some(b => b.id === newBlock.id)) {
        console.warn("Block already exists, skipping duplicate:", newBlock.id);
        return prevBlocks;
      }
      const nextPos = newBlock.position ?? (prevBlocks.length === 0
        ? 0
        : Math.max(...prevBlocks.map((b) => Math.floor(b.position))) + 1);
      return [
        ...prevBlocks,
        {
          ...newBlock,
          position: nextPos,
          column: newBlock.column ?? 0,
        },
      ];
    });
    setIsCreatingBlock(false);
    
    // Mark this block as new so we can animate it
    setNewBlockIds((prev) => new Set(prev).add(newBlock.id));
    
    // Remove from new blocks set after animation completes
    setTimeout(() => {
      setNewBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(newBlock.id);
        return next;
      });
    }, 400);
    
    // Optionally refresh in the background to ensure sync
    // We do this silently without waiting for it
    setTimeout(() => {
      router.refresh();
    }, 1000);
  };

  // Handle click on empty canvas to create text block
  const handleEmptyCanvasClick = async () => {
    if (hasBlocks || isCreatingBlock) return; // Don't create if blocks already exist or already creating
    
    setIsCreatingBlock(true);

    // Create optimistic block IMMEDIATELY
    const optimisticBlockId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticBlock: Block = {
      id: optimisticBlockId,
      tab_id: tabId,
      parent_block_id: null,
      type: "text",
      content: { text: "" },
      position: 0,
      column: 0,
      is_template: false,
      template_name: null,
      original_block_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Show block INSTANTLY
    handleBlockCreated(optimisticBlock);

    // Server call in background
    try {
      const result = await createBlock({
        tabId,
        type: "text",
        content: { text: "" },
      });

      if (result.error) {
        console.error("Failed to create text block:", result.error);
        alert(`Error creating block: ${result.error}`);
        // Remove optimistic block on error
        router.refresh();
        setIsCreatingBlock(false);
        return;
      }

      if (result.data) {
        resolveOptimisticBlock(optimisticBlockId, result.data);
      }
    } catch (error) {
      console.error("Create block exception:", error);
      router.refresh();
      setIsCreatingBlock(false);
    }
  };

  return (
    <div className="space-y-2">
      {!hasBlocks ? (
        <div
          onClick={handleEmptyCanvasClick}
          className="cursor-text rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 px-6 py-16 transition-colors hover:border-[var(--foreground)]"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEmptyCanvasClick();
            }
          }}
        >
          <EmptyCanvasState tabId={tabId} projectId={projectId} />
        </div>
      ) : (
        <div 
          className={cn(
            "rounded-2xl border border-[var(--border)]/50 p-6 shadow-sm transition-all duration-300 relative backdrop-blur-sm",
            currentTheme.containerBg ? "" : "bg-[var(--surface)]/40"
          )}
          style={currentTheme.containerBg ? { background: currentTheme.containerBg } : undefined}
        >
          {!isMounted ? (
            <div className="space-y-5">
              {blockRows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className={cn(
                    "grid gap-4",
                    row.blocks.length === 1
                      ? "grid-cols-1"
                      : row.maxColumns === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  )}
                >
                  {row.blocks.map((block) => (
                    <div key={block.id} className={cn("min-w-0", newBlockIds.has(block.id) && "animate-block-swoosh-in")}>
                      <BlockRenderer
                        block={block}
                        workspaceId={workspaceId}
                        projectId={projectId}
                        tabId={tabId}
                        onUpdate={handleUpdate}
                        scrollToTaskId={scrollToTaskId}
                        onDelete={handleDelete}
                        onConvert={handleConvert}
                        onOpenDoc={setOpenDocId}
                        isDragging={false}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-5 w-full">
                {blockRows.map((row, rowIdx) => (
                  <SortableContext
                    key={rowIdx}
                    items={row.blocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className={cn(
                        "grid gap-4",
                        row.blocks.length === 1
                          ? "grid-cols-1"
                          : row.maxColumns === 2
                          ? "grid-cols-1 md:grid-cols-2"
                          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
                      )}
                    >
                      {row.blocks.map((block) => (
                        <div
                          key={block.id}
                          className={cn(
                            "min-w-0",
                            newBlockIds.has(block.id) && "animate-block-swoosh-in",
                          )}
                        >
                          <BlockRenderer
                            block={block}
                            workspaceId={workspaceId}
                            projectId={projectId}
                            tabId={tabId}
                            onUpdate={handleUpdate}
                            scrollToTaskId={scrollToTaskId}
                            onDelete={handleDelete}
                            onConvert={handleConvert}
                            onOpenDoc={setOpenDocId}
                            isDragging={isDragging && draggedBlock?.id === block.id}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                ))}
              </div>
            </DndContext>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <AddBlockButton
          tabId={tabId}
          projectId={projectId}
          onBlockCreated={handleBlockCreated}
          onBlockResolved={resolveOptimisticBlock}
          getNextPosition={getNextPosition}
        />
      </div>

      {/* Doc Sidebar */}
      <DocSidebar docId={openDocId} onClose={() => setOpenDocId(null)} />
    </div>
  );
}
