"use client";

import { useEffect, useMemo, useState } from "react";
import { Block } from "@/app/actions/block";
import { BlockComment } from "@/types/block-comment";
import { ClientCommentIdentity } from "./use-client-comment-identity";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Pencil, Trash2, X } from "lucide-react";

interface ClientBlockCommentsProps {
  block: Block;
  comments: BlockComment[];
  publicToken: string;
  identity: ClientCommentIdentity | null;
  setIdentityName: (name: string) => void;
  onCommentsChange: (comments: BlockComment[]) => void;
  onClose: () => void;
}

type PendingIntent = "showInput" | "submit" | null;

export function ClientBlockCommentsPanel({
  block,
  comments,
  publicToken,
  identity,
  setIdentityName,
  onCommentsChange,
  onClose,
}: ClientBlockCommentsProps) {
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState(identity?.name ?? "");
  useEffect(() => {
    setNameDraft(identity?.name ?? "");
  }, [identity?.name]);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent>(null);
  const [newComment, setNewComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visitorId = identity?.id;

  const isOwnComment = (comment: BlockComment) => {
    if (!visitorId) return false;
    return (
      comment.source === "external" &&
      comment.author_id === `client:${visitorId}`
    );
  };

  const sortedComments = useMemo(() => {
    return [...comments].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [comments]);

  const handleNameSubmit = () => {
    const cleaned = nameDraft.trim();
    if (!cleaned) {
      alert("Please enter your name to continue.");
      return;
    }
    setIdentityName(cleaned);
    setShowNameDialog(false);
    const intent = pendingIntent;
    setPendingIntent(null);
    if (intent === "showInput") {
      setShowCommentInput(true);
    } else if (intent === "submit") {
      submitNewComment();
    }
  };

  const submitNewComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed || !identity?.name || !visitorId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/client-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          blockId: block.id,
          text: trimmed,
          authorName: identity.name,
          visitorId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add comment.");
      }
      onCommentsChange(Array.isArray(data.comments) ? data.comments : []);
      setNewComment("");
      setShowCommentInput(false);
    } catch (error) {
      console.error("Failed to add client comment:", error);
      alert(
        error instanceof Error ? error.message : "Failed to add comment. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!identity?.name) {
      setPendingIntent("submit");
      setShowNameDialog(true);
      return;
    }
    await submitNewComment();
  };

  const handleStartComment = () => {
    if (!identity?.name) {
      setPendingIntent("showInput");
      setShowNameDialog(true);
      return;
    }
    setShowCommentInput(true);
  };

  const mutateExistingComment = async (
    method: "PATCH" | "DELETE",
    payload: Record<string, unknown>
  ) => {
    if (!visitorId) {
      alert("Please wait while we prepare the commenting experience.");
      return;
    }
    const response = await fetch("/api/client-comments", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicToken,
        blockId: block.id,
        visitorId,
        ...payload,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to update comment.");
    }
    onCommentsChange(Array.isArray(data.comments) ? data.comments : []);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    setIsSavingEdit(true);
    try {
      await mutateExistingComment("PATCH", {
        commentId: editingId,
        text: editingText.trim(),
      });
      setEditingId(null);
      setEditingText("");
    } catch (error) {
      console.error("Failed to edit comment:", error);
      alert(
        error instanceof Error ? error.message : "Unable to edit this comment."
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      await mutateExistingComment("DELETE", { commentId });
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert(
        error instanceof Error ? error.message : "Unable to delete this comment."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="w-64 flex-shrink-0 border-l border-[var(--border)] pl-3 ml-3 relative z-10 flex flex-col bg-[var(--surface)] rounded-r-[6px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--foreground)]">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {sortedComments.map((comment) => {
          const isClientComment = comment.source === "external";
          const mine = isOwnComment(comment);
          const initial =
            comment.author_name?.charAt(0).toUpperCase() ??
            comment.author_email?.charAt(0).toUpperCase() ??
            "C";
          const timeAgo = getTimeAgo(new Date(comment.timestamp));
          const isEditing = editingId === comment.id;

          return (
            <div
              key={comment.id}
              className="group/comment relative rounded-[4px] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-xs w-full"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-[var(--velvet-purple)]/15 text-[var(--velvet-purple)] text-[9px] font-semibold flex-shrink-0">
                      {mine ? "You" : initial}
                    </span>
                    <span className="font-medium text-[var(--foreground)] text-xs truncate max-w-[110px]">
                      {mine ? "You" : comment.author_name || comment.author_email || "Client"}
                    </span>
                    {isClientComment ? (
                      <span className="text-[9px] uppercase tracking-wide rounded-full bg-blue-50 text-blue-700 px-1.5 py-0.5">
                        Client
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-wide rounded-full bg-neutral-100 text-neutral-600 px-1.5 py-0.5">
                        Team
                      </span>
                    )}
                    <span className="text-[var(--tertiary-foreground)] text-[10px] font-normal">
                      {timeAgo}
                    </span>
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        rows={3}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                          disabled={isSavingEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit || !editingText.trim()}
                        >
                          {isSavingEdit ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[var(--muted-foreground)] leading-normal whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  )}
                </div>
                {mine && !isEditing && (
                  <div className="flex gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                    <button
                      className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingText(comment.text);
                      }}
                      title="Edit comment"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="text-[var(--tertiary-foreground)] hover:text-red-500"
                      onClick={() => handleDelete(comment.id)}
                      title="Delete comment"
                      disabled={deletingId === comment.id}
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        {showCommentInput ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add comment... (Enter to submit)"
              className="w-full min-h-[60px] rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setShowCommentInput(false);
                  setNewComment("");
                }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setShowCommentInput(false);
                  setNewComment("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={handleAddComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartComment}
            className="flex items-center gap-1 text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] text-xs"
          >
            <MessageSquare className="h-3 w-3" />
            Add comment
          </button>
        )}
      </div>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share your name</DialogTitle>
            <DialogDescription>
              We’ll show this name next to any comments you leave. It only lives in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g. Taylor (Acme Co.)"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNameDialog(false);
                  setPendingIntent(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleNameSubmit}>Save name</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}${diffInMinutes === 1 ? " min" : " mins"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}${diffInHours === 1 ? " hr" : " hrs"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}${diffInDays === 1 ? " day" : " days"} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}${diffInWeeks === 1 ? " wk" : " wks"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}${diffInMonths === 1 ? " mo" : " mos"} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}${diffInYears === 1 ? " yr" : " yrs"} ago`;
}

