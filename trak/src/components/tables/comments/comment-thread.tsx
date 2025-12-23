"use client";

import type { TableComment } from "@/types/table";

interface Props {
  comment: TableComment;
  replies: TableComment[];
  onReply: (content: string, parentId: string) => void;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
}

export function CommentThread({ comment, replies, onReply, onDelete, onResolve }: Props) {
  return (
    <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface-muted)] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-[var(--foreground)] whitespace-pre-line">{comment.content}</div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <button onClick={() => onResolve(comment.id, !comment.resolved)} className="hover:text-[var(--foreground)] transition-colors duration-150">
            {comment.resolved ? "Unresolve" : "Resolve"}
          </button>
          <button onClick={() => onDelete(comment.id)} className="hover:text-[var(--error)] transition-colors duration-150">
            Delete
          </button>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="pl-3 border-l border-[var(--border)] flex flex-col gap-2">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start justify-between gap-2">
              <div className="text-sm text-[var(--foreground)] whitespace-pre-line">{reply.content}</div>
              <button onClick={() => onDelete(reply.id)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--error)] transition-colors duration-150">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
        onClick={() => onReply("", comment.id)}
      >
        Reply
      </button>
    </div>
  );
}
