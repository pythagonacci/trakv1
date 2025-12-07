"use client";

import { useEffect, useState } from "react";
import { Block } from "@/app/actions/block";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useClientCommentIdentity } from "./use-client-comment-identity";
import { ClientBlockCommentsPanel } from "./client-block-comments";
import { BlockComment } from "@/types/block-comment";
import { MessageSquare } from "lucide-react";

// Import the exact same BlockRenderer as internal pages for perfect duplication
const BlockRenderer = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer"));

interface ClientPageContentProps {
  blocks: Block[];
  publicToken: string;
  allowComments?: boolean;
}

interface BlockRow {
  rowIndex: number;
  blocks: Block[];
  maxColumns: number;
}

const formatShortDate = (date?: string) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
};

export default function ClientPageContent({ blocks, publicToken, allowComments = false }: ClientPageContentProps) {
  const [blockState, setBlockState] = useState(blocks);
  const { identity, setIdentityName } = useClientCommentIdentity(publicToken, allowComments);

  useEffect(() => {
    setBlockState(blocks);
  }, [blocks]);

  const handleCommentsChange = (blockId: string, updatedComments: BlockComment[]) => {
    setBlockState((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              content: { ...(block.content || {}), _blockComments: updatedComments },
            }
          : block
      )
    );
  };
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[var(--muted-foreground)]">No content in this tab yet.</p>
      </div>
    );
  }

  // EXACT SAME LOGIC as internal TabCanvas: Group blocks by row and calculate max columns
  const blockRows: BlockRow[] = blockState.reduce((rows, block) => {
    const rowIndex = Math.floor(block.position);
    const existingRow = rows.find(r => r.rowIndex === rowIndex);

    if (existingRow) {
      existingRow.blocks.push(block);
      existingRow.maxColumns = Math.max(existingRow.maxColumns, block.column + 1);
    } else {
      rows.push({
        rowIndex,
        blocks: [block],
        maxColumns: block.column + 1,
      });
    }

    return rows;
  }, [] as BlockRow[]);

  return (
    <div className="space-y-5">
      {blockRows
        .sort((a, b) => a.rowIndex - b.rowIndex)
        .map((row) => (
          <div
            key={row.rowIndex}
            className={cn(
              "grid gap-4",
              row.blocks.length === 1
                ? "grid-cols-1"
                : row.maxColumns === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            )}
          >
            {row.blocks
              .sort((a, b) => a.column - b.column)
              .map((block) => {
                const supportsComments = allowComments && block.type !== "divider";
                const blockContent = (block.content || {}) as Record<string, any>;
                const blockComments: BlockComment[] = Array.isArray(blockContent._blockComments)
                  ? (blockContent._blockComments as BlockComment[])
                  : [];
                const commentCount = blockComments.length;

                const blockElement = (
                  <BlockRenderer
                    block={block}
                    workspaceId=""
                    projectId=""
                    tabId=""
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    onConvert={() => {}}
                    onOpenDoc={() => {}}
                    isDragging={false}
                  />
                );

                if (!supportsComments) {
                  return (
                    <div key={block.id} className="min-w-0">
                      {blockElement}
                    </div>
                  );
                }

                return (
                  <div key={block.id} className="min-w-0">
                    <div className="flex items-start gap-0">
                      <div className="relative flex-1 min-w-0">
                        <button
                          onClick={() => {
                            // Toggle comments panel - simplified for now
                            console.log('Toggle comments for block:', block.id);
                          }}
                          className={cn(
                            "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--tertiary-foreground)] shadow-sm transition-colors",
                            "hover:text-[var(--foreground)]"
                          )}
                        >
                          <MessageSquare className="h-3 w-3" />
                          {commentCount > 0 && <span>{commentCount}</span>}
                        </button>
                        {blockElement}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
    </div>
  );
}

// Using exact same BlockRenderer as internal pages - true duplication achieved


