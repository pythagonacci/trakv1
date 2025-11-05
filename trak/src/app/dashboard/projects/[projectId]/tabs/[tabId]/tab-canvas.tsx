"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Block, deleteBlock, updateBlock, createBlock } from "@/app/actions/block";
import EmptyCanvasState from "./empty-canvas-state";
import AddBlockButton from "./add-block-button";
import BlockRenderer from "./block-renderer";

interface TabCanvasProps {
  tabId: string;
  projectId: string;
  workspaceId: string;
  blocks: Block[];
}

interface BlockRow {
  rowIndex: number;
  blocks: Block[];
  maxColumns: number; // 1, 2, or 3 - how many columns this row has
}

export default function TabCanvas({ tabId, projectId, workspaceId, blocks: initialBlocks }: TabCanvasProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);

  // Configure sensors for drag and drop (mouse, touch, keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Organize blocks into rows
  // Blocks in the same row are side-by-side (have different column values but similar positions)
  // Blocks in different rows are stacked vertically
  const blockRows = useMemo(() => {
    if (blocks.length === 0) return [];

    // Sort blocks by position (vertical order)
    const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

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
        // Determine max columns in this row
        const maxCol = Math.max(...rowBlocks.map(b => {
          const col = b.column !== undefined && b.column >= 0 && b.column <= 2 ? b.column : 0;
          return col;
        }));
        const maxColumns = maxCol + 1; // If max column is 2, we have 3 columns (0, 1, 2)
        
        return {
          rowIndex,
          blocks: rowBlocks,
          maxColumns: Math.max(1, Math.min(3, maxColumns)),
        };
      });

    return rows;
  }, [blocks]);

  const handleUpdate = () => {
    router.refresh();
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

  const handleConvert = async (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "image" | "video" | "embed" | "pdf" | "section") => {
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
    setIsDragging(true);
    const block = blocks.find((b) => b.id === event.active.id);
    setDraggedBlock(block || null);
  };

  // Handle drag end - reorder blocks or move between rows/columns
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || !draggedBlock || active.id === over.id) {
      setDraggedBlock(null);
      return;
    }

    const overBlock = blocks.find((b) => b.id === over.id);
    if (!overBlock) {
      setDraggedBlock(null);
      return;
    }

    const overRowIndex = Math.floor(overBlock.position);
    const overCol = overBlock.column !== undefined && overBlock.column >= 0 && overBlock.column <= 2 ? overBlock.column : 0;

    // Find the target row
    const targetRow = blockRows.find(r => r.rowIndex === overRowIndex);
    if (!targetRow) {
      setDraggedBlock(null);
      return;
    }

    // Get blocks currently in the target row (excluding the dragged block)
    const currentRowBlocks = targetRow.blocks.filter(b => b.id !== draggedBlock.id);
    const usedColumns = new Set(currentRowBlocks.map(b => {
      const col = b.column !== undefined && b.column >= 0 && b.column <= 2 ? b.column : 0;
      return col;
    }));

    // Determine the new column for the dragged block
    // Strategy: Place it next to the block we're dropping on
    let newCol: number;
    
    if (usedColumns.size === 0) {
      // Empty row - place in column 0 (full width)
      newCol = 0;
    } else if (usedColumns.size === 1 && usedColumns.has(0)) {
      // One block in column 0 - place in column 1 (create 2-column layout)
      newCol = 1;
    } else if (usedColumns.size === 2 && !usedColumns.has(2)) {
      // Two blocks, columns 0 and 1 - place in column 2 (create 3-column layout)
      newCol = 2;
    } else {
      // Row is full (3 columns) or complex layout - place next to the target block
      // Find next available column after the target block's column
      if (overCol < 2 && !usedColumns.has(overCol + 1)) {
        newCol = overCol + 1;
      } else if (overCol > 0 && !usedColumns.has(overCol - 1)) {
        newCol = overCol - 1;
      } else {
        // No space next to target - place in first available column
        if (!usedColumns.has(0)) newCol = 0;
        else if (!usedColumns.has(1)) newCol = 1;
        else if (!usedColumns.has(2)) newCol = 2;
        else newCol = overCol; // Fallback - will shift others
      }
    }

    // Update the dragged block's position and column to be in the target row
    // Position is an integer representing the row, column differentiates blocks in the same row
    const newPosition = overRowIndex;

    // If we're placing in a column that's already taken, we need to shift other blocks
    const updatedBlocks = blocks.map((block) => {
      if (block.id === draggedBlock.id) {
        return { ...block, column: newCol, position: newPosition };
      }
      
      // If another block is in the same row and same column, shift it
      const blockRowIndex = Math.floor(block.position);
      if (blockRowIndex === overRowIndex && block.id !== draggedBlock.id) {
        const blockCol = block.column !== undefined && block.column >= 0 && block.column <= 2 ? block.column : 0;
        if (blockCol === newCol) {
          // Shift this block to the next available column
          for (let shiftCol = 0; shiftCol <= 2; shiftCol++) {
            if (shiftCol !== newCol && !usedColumns.has(shiftCol) && shiftCol !== blockCol) {
              return { ...block, column: shiftCol, position: overRowIndex };
            }
          }
          // If no space, shift right (but max column 2)
          const shiftedCol = Math.min(2, blockCol + 1);
          if (shiftedCol !== newCol) {
            return { ...block, column: shiftedCol, position: overRowIndex };
          }
        }
      }
      return block;
    });

    setBlocks(updatedBlocks);
    justDraggedRef.current = true; // Mark that we just dragged

    // Update on server
    try {
      // Validate values before sending
      if (newCol < 0 || newCol > 2) {
        throw new Error(`Invalid column value: ${newCol}. Must be between 0 and 2.`);
      }
      if (newPosition < 0 || !isFinite(newPosition)) {
        throw new Error(`Invalid position value: ${newPosition}`);
      }
      
      // Update the dragged block first
      const updateResult = await updateBlock({ blockId: draggedBlock.id, column: newCol, position: newPosition });
      
      if (updateResult.error) {
        throw new Error(updateResult.error);
      }
      
      // Update other blocks that were shifted
      const shiftedBlocks = updatedBlocks.filter(b => {
        if (b.id === draggedBlock.id) return false;
        const bRowIndex = Math.floor(b.position);
        const bCol = b.column !== undefined && b.column >= 0 && b.column <= 2 ? b.column : 0;
        const originalBlock = blocks.find(orig => orig.id === b.id);
        if (!originalBlock) return false;
        const origRowIndex = Math.floor(originalBlock.position);
        const origCol = originalBlock.column !== undefined && originalBlock.column >= 0 && originalBlock.column <= 2 ? originalBlock.column : 0;
        return bRowIndex === overRowIndex && (origRowIndex !== bRowIndex || origCol !== bCol);
      });
      
      if (shiftedBlocks.length > 0) {
        const updatePromises = shiftedBlocks.map(block => {
          const col = block.column !== undefined && block.column >= 0 && block.column <= 2 ? block.column : 0;
          const pos = block.position;
          
          // Validate before updating
          if (col < 0 || col > 2) {
            console.warn(`Invalid column for block ${block.id}: ${col}`);
          }
          if (pos < 0 || !isFinite(pos)) {
            console.warn(`Invalid position for block ${block.id}: ${pos}`);
          }
          
          return updateBlock({ blockId: block.id, column: col, position: pos });
        });
        const results = await Promise.all(updatePromises);
        
        // Check if any updates failed
        const failedResults = results.filter(r => r.error);
        if (failedResults.length > 0) {
          const errorMessages = failedResults.map(r => r.error).join(", ");
          throw new Error(`Some block updates failed: ${errorMessages}`);
        }
      }
      
      // Don't refresh immediately - let the optimistic update stand
      // The data will be fresh on next navigation or page reload
      // If we need to refresh, we can do it after a delay, but for now
      // the optimistic update should be sufficient
    } catch (error) {
      console.error("Failed to update block position:", error);
      // Revert optimistic update on error
      setBlocks(blocks);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to move block: ${errorMessage}`);
    }

    setDraggedBlock(null);
  };

  // Sync blocks when props change (e.g., initial load or external changes)
  // But use a ref to track if we just did a drag operation to avoid overwriting optimistic updates
  const justDraggedRef = useRef(false);
  
  useEffect(() => {
    // If we just dragged, skip this sync to preserve optimistic update
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  // Only mount DnD on client to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasBlocks = blocks.length > 0;

  // Handle click on empty canvas to create text block
  const handleEmptyCanvasClick = async () => {
    if (hasBlocks || isCreatingBlock) return; // Don't create if blocks already exist or already creating
    
    setIsCreatingBlock(true);
    try {
      const result = await createBlock({
        tabId,
        type: "text",
        content: { text: "" },
      });

      if (result.error) {
        console.error("Failed to create text block:", result.error);
        alert(`Error creating block: ${result.error}`);
        setIsCreatingBlock(false);
        return;
      }

      // Refresh to show the new block
      router.refresh();
    } catch (error) {
      console.error("Create block exception:", error);
      setIsCreatingBlock(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hasBlocks ? (
        <div 
          onClick={handleEmptyCanvasClick} 
          className="cursor-text min-h-[400px]"
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
      ) : !isMounted ? (
        // Render without DnD during SSR to avoid hydration mismatch
        <div className="space-y-4">
          {blockRows.map((row, rowIdx) => (
            <div 
              key={rowIdx} 
              className={`grid gap-4 ${row.maxColumns === 1 ? 'grid-cols-1' : row.maxColumns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
            >
              {row.blocks.map((block) => (
                <div key={block.id} className="min-w-0 w-full">
                  <BlockRenderer
                    block={block}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    tabId={tabId}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onConvert={handleConvert}
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
          <div className="space-y-4">
            {blockRows.map((row, rowIdx) => {
              const rowBlockIds = row.blocks.map(b => b.id);
              return (
                <SortableContext
                  key={rowIdx}
                  items={rowBlockIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div 
                    className={`grid gap-4 ${row.maxColumns === 1 ? 'grid-cols-1' : row.maxColumns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                  >
                    {/* Render blocks, ensuring proper column placement */}
                    {Array.from({ length: row.maxColumns }).map((_, colIdx) => {
                      const blockInThisColumn = row.blocks.find(block => {
                        const col = block.column !== undefined && block.column >= 0 && block.column <= 2 ? block.column : 0;
                        return col === colIdx;
                      });
                      
                      if (!blockInThisColumn) {
                        // Empty slot - render nothing or a placeholder
                        return <div key={`empty-${colIdx}`} />;
                      }
                      
                      return (
                        <div key={blockInThisColumn.id} className="min-w-0 w-full">
                          <BlockRenderer
                            block={blockInThisColumn}
                            workspaceId={workspaceId}
                            projectId={projectId}
                            tabId={tabId}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onConvert={handleConvert}
                            isDragging={isDragging}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SortableContext>
              );
            })}
          </div>
        </DndContext>
      )}

      {/* Add Block Button - Subtle, minimal */}
      <div className="flex gap-2 mt-4">
        <AddBlockButton tabId={tabId} projectId={projectId} />
      </div>
    </div>
  );
}