"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Block, deleteBlock, updateBlock } from "@/app/actions/block";
import EmptyCanvasState from "./empty-canvas-state";
import AddBlockButton from "./add-block-button";
import BlockRenderer from "./block-renderer";

interface TabCanvasProps {
  tabId: string;
  projectId: string;
  workspaceId: string;
  blocks: Block[];
}

export default function TabCanvas({ tabId, projectId, workspaceId, blocks: initialBlocks }: TabCanvasProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

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

  const handleConvert = async (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "image" | "embed") => {
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
    } else if (newType === "embed") {
      newContent = { url: "", displayMode: "inline" };
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

  // Handle drag end - reorder blocks
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return;
    }

    // Optimistic update - reorder blocks immediately
    const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reorderedBlocks);

    // Calculate new positions for all affected blocks
    // Update all blocks with their new positions
    const updates: Array<{ blockId: string; position: number }> = [];
    
    reorderedBlocks.forEach((block, index) => {
      // Only update if position actually changed
      const originalPosition = blocks.findIndex(b => b.id === block.id);
      if (originalPosition !== index) {
        updates.push({ blockId: block.id, position: index });
      }
    });

    // Update all affected blocks on server
    try {
      const updatePromises = updates.map(({ blockId, position }) =>
        updateBlock({ blockId, position })
      );

      await Promise.all(updatePromises);

      // Refresh to ensure consistency
      router.refresh();
    } catch (error) {
      console.error("Failed to update block positions:", error);
      // Revert optimistic update on error
      setBlocks(blocks);
      alert("Failed to reorder blocks. Please try again.");
    }
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Sync blocks when props change (e.g., after server refresh)
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  // Only mount DnD on client to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const blockIds = blocks.map((block) => block.id);

  return (
    <div className="space-y-6">
      {blocks.length === 0 ? (
        <EmptyCanvasState tabId={tabId} projectId={projectId} />
      ) : !isMounted ? (
        // Render without DnD during SSR to avoid hydration mismatch
        blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            workspaceId={workspaceId}
            projectId={projectId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onConvert={handleConvert}
            isDragging={false}
          />
        ))
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                workspaceId={workspaceId}
                projectId={projectId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onConvert={handleConvert}
                isDragging={isDragging}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Add Block Button */}
      <div className="flex gap-2">
        <AddBlockButton tabId={tabId} projectId={projectId} />
      </div>
    </div>
  );
}