"use client";

import { useEffect, useState } from "react";
import { Block } from "@/app/actions/block";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useClientCommentIdentity } from "./use-client-comment-identity";
import { ClientBlockCommentsPanel } from "./client-block-comments";
import { ClientBlockEditDialog } from "./client-block-edit-dialog";
import { BlockComment } from "@/types/block-comment";
import { Edit3, MessageSquare } from "lucide-react";
import { AIProvider } from "@/components/ai/ai-context";
import type { EntityProperties } from "@/types/properties";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isClientEditableBlockType } from "@/lib/client-page-edits";

// Import the exact same BlockRenderer as internal pages for perfect duplication
const BlockRenderer = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer"));

// Import FileUrlContext from internal pages so BlockRenderer can use it
import { FileUrlContext } from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas";

interface ClientPageContentProps {
  blocks: Block[];
  publicToken: string;
  allowComments?: boolean;
  allowEditing?: boolean;
  initialFileUrls?: Record<string, string>;
  initialFilesByBlockId?: Record<
    string,
    Array<{
      id: string;
      display_mode: string;
      file: {
        id: string;
        file_name: string;
        file_size: number;
        file_type: string;
        storage_path: string;
        created_at: string;
      };
    }>
  >;
  blockPropertiesById?: Record<string, EntityProperties>;
}

interface BlockRow {
  rowIndex: number;
  blocks: Block[];
  maxColumns: number;
}

export default function ClientPageContent({
  blocks,
  publicToken,
  allowComments = false,
  allowEditing = false,
  initialFileUrls = {},
  initialFilesByBlockId = {},
  blockPropertiesById = {},
}: ClientPageContentProps) {
  const [blockState, setBlockState] = useState(blocks);
  const [activeCommentsBlockId, setActiveCommentsBlockId] = useState<string | null>(null);
  const [editTargetBlockId, setEditTargetBlockId] = useState<string | null>(null);
  const [pendingEditBlockId, setPendingEditBlockId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const { identity, setIdentityName } = useClientCommentIdentity(
    publicToken,
    allowComments || allowEditing
  );

  useEffect(() => {
    setBlockState(blocks);
  }, [blocks]);

  useEffect(() => {
    setNameDraft(identity?.name ?? "");
  }, [identity?.name]);

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

  const handleBlockChange = (updatedBlock: Block) => {
    setBlockState((prev) =>
      prev.map((block) => (block.id === updatedBlock.id ? updatedBlock : block))
    );
  };

  const handleRequestEdit = (blockId: string) => {
    if (!allowEditing) return;
    if (!identity?.name) {
      setPendingEditBlockId(blockId);
      setShowNameDialog(true);
      return;
    }
    setEditTargetBlockId(blockId);
  };

  const handleNameSubmit = () => {
    const cleaned = nameDraft.trim();
    if (!cleaned) {
      alert("Please enter your name to continue.");
      return;
    }
    setIdentityName(cleaned);
    setShowNameDialog(false);
    if (pendingEditBlockId) {
      setEditTargetBlockId(pendingEditBlockId);
      setPendingEditBlockId(null);
    }
  };

  const editTargetBlock =
    editTargetBlockId == null
      ? null
      : blockState.find((block) => block.id === editTargetBlockId) ?? null;

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
    <AIProvider>
      <FileUrlContext.Provider value={initialFileUrls}>
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
                  const supportsEditing =
                    allowEditing && isClientEditableBlockType(block.type);
                  const blockContent = (block.content || {}) as Record<string, unknown>;
                  const blockComments: BlockComment[] = Array.isArray(blockContent._blockComments)
                    ? (blockContent._blockComments as BlockComment[])
                    : [];
                  const commentCount = blockComments.length;
                  const commentsOpen = activeCommentsBlockId === block.id;

                  const blockElement = (
                    <BlockRenderer
                      block={block}
                      workspaceId=""
                      projectId=""
                      tabId=""
                      blockProperties={blockPropertiesById[block.id]}
                      propertiesById={blockPropertiesById}
                      readOnly
                      publicToken={publicToken}
                      initialFiles={initialFilesByBlockId[block.id]}
                      onUpdate={(updatedBlock) => {
                        if (updatedBlock) handleBlockChange(updatedBlock);
                      }}
                      onDelete={() => {}}
                      onConvert={() => {}}
                      onOpenDoc={() => {}}
                      isDragging={false}
                      allowPublicEditing={allowEditing}
                      clientIdentity={identity}
                      setClientIdentityName={setIdentityName}
                    />
                  );

                  if (!supportsComments && !supportsEditing) {
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
                          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                            {supportsEditing && (
                              <button
                                onClick={() => handleRequestEdit(block.id)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--tertiary-foreground)] shadow-sm transition-colors",
                                  "hover:text-[var(--foreground)]"
                                )}
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                            )}
                            {supportsComments && (
                              <button
                                onClick={() =>
                                  setActiveCommentsBlockId((current) =>
                                    current === block.id ? null : block.id
                                  )
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--tertiary-foreground)] shadow-sm transition-colors",
                                  "hover:text-[var(--foreground)]"
                                )}
                              >
                                <MessageSquare className="h-3 w-3" />
                                {commentCount > 0 && <span>{commentCount}</span>}
                              </button>
                            )}
                          </div>
                          {blockElement}
                        </div>
                        {supportsComments && commentsOpen && (
                          <ClientBlockCommentsPanel
                            block={block}
                            comments={blockComments}
                            publicToken={publicToken}
                            identity={identity}
                            setIdentityName={setIdentityName}
                            onCommentsChange={(updatedComments) =>
                              handleCommentsChange(block.id, updatedComments)
                            }
                            onClose={() => setActiveCommentsBlockId(null)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </FileUrlContext.Provider>
      <ClientBlockEditDialog
        block={editTargetBlock}
        open={Boolean(editTargetBlock)}
        publicToken={publicToken}
        identity={identity}
        onOpenChange={(open) => {
          if (!open) setEditTargetBlockId(null);
        }}
        onSave={handleBlockChange}
      />
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share your name</DialogTitle>
            <DialogDescription>
              We’ll use this name for any comments or edits you make during this visit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="e.g. Taylor (Acme Co.)"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNameDialog(false);
                  setPendingEditBlockId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleNameSubmit}>Save name</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AIProvider>
  );
}

// Using exact same BlockRenderer as internal pages - true duplication achieved
