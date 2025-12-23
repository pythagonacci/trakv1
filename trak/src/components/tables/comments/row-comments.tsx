"use client";

import { useState } from "react";
import { CommentInput } from "./comment-input";
import { CommentThread } from "./comment-thread";
import { useRowComments, useCreateComment, useDeleteComment, useResolveComment } from "@/lib/hooks/use-table-queries";
import type { TableComment } from "@/types/table";

interface Props {
  rowId: string;
  onClose: () => void;
}

export function RowComments({ rowId, onClose }: Props) {
  const { data: comments = [], isLoading } = useRowComments(rowId);
  const createComment = useCreateComment(rowId);
  const deleteComment = useDeleteComment(rowId, "");
  const resolveComment = useResolveComment(rowId, "");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const roots = comments.filter((c) => !c.parent_id);
  const byParent = comments.reduce<Record<string, TableComment[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = acc[c.parent_id] || [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="w-96 h-full bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="text-sm font-semibold text-[var(--foreground)]">Comments</div>
        <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {isLoading && <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>}
        {!isLoading && roots.length === 0 && (
          <div className="text-sm text-[var(--muted-foreground)]">No comments yet.</div>
        )}
        {roots.map((root) => (
          <CommentThread
            key={root.id}
            comment={root}
            replies={byParent[root.id] || []}
            onReply={(content, parentId) => {
              setReplyTo(parentId);
            }}
            onDelete={(commentId) => deleteComment.mutate(commentId)}
            onResolve={(commentId, resolved) => resolveComment.mutate({ commentId, resolved })}
          />
        ))}
      </div>
      <div className="border-t border-[var(--border)] p-4">
        <CommentInput
          submitting={createComment.isPending}
          onSubmit={(content) =>
            createComment.mutate({
              content,
              parentId: replyTo ?? undefined,
            })
          }
          onCancel={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
}
