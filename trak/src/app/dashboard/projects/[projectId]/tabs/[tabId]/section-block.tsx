"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Block, getChildBlocks, updateBlock } from "@/app/actions/block";
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

  const handleDelete = async (blockId: string) => {
    // Remove from local state
    setChildBlocks(prev => prev.filter(b => b.id !== blockId));
    router.refresh();
  };

  const handleConvert = async (blockId: string, newType: any) => {
    // Not implemented for child blocks for now
    router.refresh();
  };


  return (
    <div className="w-full">
      <div className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
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
              className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-[var(--foreground)] focus:outline-none"
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
              className="mt-2 w-full resize-none rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] focus:outline-none"
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
            <div className="flex flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/60 px-5 py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">This section is empty.</p>
              <AddBlockButton
                tabId={tabId}
                projectId={projectId}
                parentBlockId={block.id}
                onBlockCreated={handleUpdate}
                variant="large"
              />
            </div>
          ) : (
            <>
              {childBlocks.map((childBlock) => (
                <div key={childBlock.id} className="w-full">
                  <BlockRenderer
                    block={childBlock}
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
              <div className="pt-2">
                <AddBlockButton
                  tabId={tabId}
                  projectId={projectId}
                  parentBlockId={block.id}
                  onBlockCreated={handleUpdate}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

