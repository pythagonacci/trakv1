"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Block, type BlockType, createBlock, getChildBlocks, updateBlock } from "@/app/actions/block";
import BlockRenderer from "./block-renderer";
import AddBlockButton from "./add-block-button";
import { cn } from "@/lib/utils";

interface SectionBlockProps {
  block: Block;
  workspaceId: string;
  projectId: string;
  tabId: string;
  onUpdate?: () => void;
}

export default function SectionBlock({ block, workspaceId, projectId, tabId, onUpdate }: SectionBlockProps) {
  const router = useRouter();
  const [childBlocks, setChildBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newChildBlockIds, setNewChildBlockIds] = useState<Set<string>>(new Set());
  const sectionContent = (block.content || {}) as {
    title?: string;
    description?: string;
    height?: number;
  };

  const title = sectionContent.title || "Section";
  const description = sectionContent.description || "";
  const height = sectionContent.height;
  const [titleValue, setTitleValue] = useState(title);
  const [descriptionValue, setDescriptionValue] = useState(description);

  // Fetch child blocks
  useEffect(() => {
    const fetchChildBlocks = async () => {
      setIsLoading(true);
      const result = await getChildBlocks(block.id);
      if (result.error) {
        console.error("Failed to fetch child blocks:", result.error);
        setChildBlocks([]);
      } else {
        setChildBlocks(result.data || []);
      }
      setIsLoading(false);
    };

    fetchChildBlocks();
  }, [block.id]);

  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  useEffect(() => {
    setDescriptionValue(description);
  }, [description]);

  const handleUpdate = () => {
    // Refresh child blocks
    const fetchChildBlocks = async () => {
      const result = await getChildBlocks(block.id);
      if (result.error) {
        console.error("Failed to fetch child blocks:", result.error);
      } else {
        setChildBlocks(result.data || []);
      }
    };
    fetchChildBlocks();
    onUpdate?.();
  };

  // Handle optimistic block creation for child blocks
  const handleChildBlockCreated = (newBlock: Block) => {
    if (!newBlock.type) {
      console.error("handleChildBlockCreated: Block missing type property:", newBlock);
      return;
    }

    // Immediately add the new block to local state (optimistic update)
    setChildBlocks((prevBlocks) => {
      if (prevBlocks.some((child) => child.id === newBlock.id)) {
        return prevBlocks;
      }

      const nextPos = newBlock.position !== undefined && newBlock.position !== null
        ? newBlock.position
        : (prevBlocks.length === 0
          ? 0
          : Math.max(...prevBlocks.map((child) => Math.floor(child.position))) + 1);

      const newBlockWithPosition = {
        ...newBlock,
        type: newBlock.type,
        position: nextPos,
        column: newBlock.column ?? 0,
      };

      return [...prevBlocks, newBlockWithPosition].sort((a, b) => a.position - b.position);
    });
    
    // Mark this block as new so we can animate it
    setNewChildBlockIds((prev) => new Set(prev).add(newBlock.id));
    
    // Remove from new blocks set after animation completes
    setTimeout(() => {
      setNewChildBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(newBlock.id);
        return next;
      });
    }, 400);
    
  };

  const persistContent = async (patch: Partial<typeof sectionContent>) => {
    try {
      await updateBlock({
        blockId: block.id,
        content: {
          ...sectionContent,
          ...patch,
        },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update section block:", error);
    }
  };

  const saveTitle = async () => {
    const trimmed = titleValue.trim();
    setEditingTitle(false);
    if (trimmed !== title) {
      await persistContent({ title: trimmed });
    }
  };

  const saveDescription = async () => {
    const next = descriptionValue.trim();
    setEditingDescription(false);
    if (next !== description) {
      await persistContent({ description: next });
    }
  };

  const getNextChildPosition = () => {
    if (childBlocks.length === 0) return 0;
    const maxPos = Math.max(...childBlocks.map((child) => Math.floor(child.position)));
    return maxPos + 1;
  };

  const isTempId = (id: string) => id.startsWith("temp-");

  const getDefaultContent = (type: BlockType) => {
    switch (type) {
      case "text":
        return { text: "" };
      case "task":
        return { title: "New Task List", hideIcons: false, viewMode: "list", boardGroupBy: "status" };
      case "link":
        return { title: null, url: null, caption: "" };
      case "divider":
        return {};
      case "table":
        return {};
      case "timeline": {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30);
        return {
          viewConfig: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            zoomLevel: "day",
            filters: {},
            groupBy: "none",
          },
        };
      }
      case "file":
      case "video":
        return { files: [] };
      case "image":
        return { fileId: null, caption: "", width: 400 };
      case "embed":
        return { url: "", displayMode: "inline" };
      case "section":
        return { height: 400 };
      case "doc_reference":
        return { doc_id: "", doc_title: "" };
      default:
        return {};
    }
  };

  const handleDelete = async (blockId: string) => {
    // Remove from local state
    setChildBlocks(prev => prev.filter(b => b.id !== blockId));
    router.refresh();
  };

  const handleConvert = async (blockId: string, newType: any) => {
    // Not implemented for child blocks for now
    router.refresh();
  };

  const resolveOptimisticChildBlock = (tempId: string, savedBlock: Block) => {
    if (!savedBlock.type) {
      console.error("resolveOptimisticChildBlock: Saved block missing type property:", savedBlock);
      return;
    }

    setChildBlocks((prevBlocks) => {
      const alreadyExists = prevBlocks.some((child) => child.id === savedBlock.id);
      if (alreadyExists) {
        return prevBlocks.filter((child) => child.id !== tempId);
      }

      let replaced = false;
      const updated = prevBlocks.map((child) => {
        if (child.id === tempId) {
          replaced = true;
          return {
            ...savedBlock,
            type: savedBlock.type,
            position: child.position ?? savedBlock.position ?? getNextChildPosition(),
            column: child.column ?? savedBlock.column ?? 0,
          };
        }
        return child;
      });

      if (!replaced && !alreadyExists) {
        return [...prevBlocks, { ...savedBlock, type: savedBlock.type }].sort((a, b) => a.position - b.position);
      }

      return updated.sort((a, b) => a.position - b.position);
    });
  };

  const handleChildBlockError = (tempId: string) => {
    setChildBlocks((prevBlocks) => prevBlocks.filter((child) => child.id !== tempId));
  };

  const shiftChildRowsForInsertion = async (insertionRow: number) => {
    const updatedBlocks = childBlocks.map((child) => {
      const childRow = Math.floor(child.position);
      if (childRow >= insertionRow) {
        return { ...child, position: childRow + 1 };
      }
      return child;
    });

    setChildBlocks(updatedBlocks);

    try {
      const changedBlocks = updatedBlocks.filter((child) => {
        const original = childBlocks.find((b) => b.id === child.id);
        if (!original) return false;
        return Math.floor(original.position) !== Math.floor(child.position);
      });

      const persistentBlocks = changedBlocks.filter(
        (child) => child.id && !isTempId(child.id),
      );

      if (persistentBlocks.length > 0) {
        const results = await Promise.all(
          persistentBlocks.map((child) =>
            updateBlock({
              blockId: child.id.trim(),
              position: Math.floor(child.position),
              column: 0,
            }),
          ),
        );
        const failed = results.filter((result) => result?.error);
        if (failed.length > 0) {
          console.error(
            "Some child block row shifts failed:",
            failed.map((f) => f.error).join(", "),
          );
        }
      }
    } catch (error) {
      console.error("Error shifting child blocks for insertion:", error);
    }
  };

  const handleAddChildBlockAtRow = async (
    targetBlockId: string,
    direction: "above" | "below",
    type: BlockType = "text",
  ) => {
    const targetBlock = childBlocks.find((child) => child.id === targetBlockId);
    if (!targetBlock) return;

    const targetRowIndex = Math.floor(targetBlock.position);
    const insertionRow = direction === "above" ? targetRowIndex : targetRowIndex + 1;

    await shiftChildRowsForInsertion(insertionRow);

    const optimisticBlockId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticBlock: Block = {
      id: optimisticBlockId,
      tab_id: tabId,
      parent_block_id: block.id,
      type,
      content: getDefaultContent(type),
      position: insertionRow,
      column: 0,
      is_template: false,
      template_name: null,
      original_block_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    handleChildBlockCreated(optimisticBlock);

    createBlock({
      tabId,
      type,
      position: insertionRow,
      parentBlockId: block.id,
    })
      .then((result) => {
        if (result.error) {
          console.error(`Failed to create child block ${direction}:`, result.error);
          handleChildBlockError(optimisticBlockId);
        } else if (result.data) {
          resolveOptimisticChildBlock(optimisticBlockId, result.data);
        }
      })
      .catch((error) => {
        console.error(`Exception creating child block ${direction}:`, error);
        handleChildBlockError(optimisticBlockId);
      });
  };

  const handleAddChildBlockAbove = (targetBlockId: string, type?: BlockType) =>
    handleAddChildBlockAtRow(targetBlockId, "above", type);

  const handleAddChildBlockBelow = (targetBlockId: string, type?: BlockType) =>
    handleAddChildBlockAtRow(targetBlockId, "below", type);


  return (
    <div className="w-full">
      <div className="w-full border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          {editingTitle ? (
            <input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTitle();
                }
                if (e.key === "Escape") {
                  setTitleValue(title);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="w-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-[var(--foreground)] focus:outline-none"
              placeholder="Section title"
            />
          ) : (
            <div
              onClick={() => setEditingTitle(true)}
              className="cursor-text text-sm font-semibold text-[var(--foreground)] hover:text-[var(--foreground)]/90"
            >
              {title || <span className="text-[var(--tertiary-foreground)]">Add title…</span>}
            </div>
          )}

          {editingDescription ? (
            <textarea
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={saveDescription}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDescriptionValue(description);
                  setEditingDescription(false);
                }
              }}
              rows={2}
              className="mt-2 w-full resize-none border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] focus:outline-none"
              placeholder="Add description…"
            />
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className={cn(
                "mt-1 cursor-text text-xs text-[var(--muted-foreground)]",
                !description && "italic text-[var(--tertiary-foreground)]"
              )}
            >
              {description || "Add description…"}
            </div>
          )}
        </div>

        <div
          className={cn(
            "space-y-2.5 px-3 py-3",
            height ? "overflow-y-auto" : ""
          )}
          style={height ? { maxHeight: `${height}px`, height: `${height}px` } : undefined}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--tertiary-foreground)]">
              Loading…
            </div>
          ) : childBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/60 px-5 py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">This section is empty.</p>
              <AddBlockButton
                tabId={tabId}
                projectId={projectId}
                parentBlockId={block.id}
                onBlockCreated={handleChildBlockCreated}
                onBlockResolved={resolveOptimisticChildBlock}
                onBlockError={handleChildBlockError}
                getNextPosition={getNextChildPosition}
                variant="large"
              />
            </div>
          ) : (
            <>
              {childBlocks.map((childBlock) => (
                <div key={childBlock.id} className={cn("w-full", newChildBlockIds.has(childBlock.id) && "animate-block-swoosh-in")}>
                  <BlockRenderer
                    block={childBlock}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    tabId={tabId}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onConvert={handleConvert}
                    onAddBlockAbove={handleAddChildBlockAbove}
                    onAddBlockBelow={handleAddChildBlockBelow}
                    isDragging={false}
                  />
                </div>
              ))}
              <div className="pt-2">
                <AddBlockButton
                  tabId={tabId}
                  projectId={projectId}
                  parentBlockId={block.id}
                  onBlockCreated={handleChildBlockCreated}
                  onBlockResolved={resolveOptimisticChildBlock}
                  onBlockError={handleChildBlockError}
                  getNextPosition={getNextChildPosition}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
