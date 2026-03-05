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
    <div className="w-full min-h-0 flex flex-col text-[var(--foreground)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0">
        <div className="text-xs font-medium text-[var(--foreground)]">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </div>
        <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-2">
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
      <div className="border-t border-[var(--border)] p-3 shrink-0">
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
