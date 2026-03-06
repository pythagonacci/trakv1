"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Reply } from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { BlockComment } from "@/types/block-comment";
import { cn } from "@/lib/utils";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";

interface BlockCommentsProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  side?: "left" | "right";
  anchorRect?: DOMRect | null;
}

export default function BlockComments({
  block,
  onUpdate,
  isOpen: externalIsOpen,
  onToggle,
  side = "right",
  anchorRect = null,
}: BlockCommentsProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(true); // Start expanded by default
  const isExpanded = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsExpanded = (value: boolean) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(value);
    } else {
      onToggle?.();
    }
  };
  const [comments, setComments] = useState<BlockComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorDisplay: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const commentsContainerRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionStartIndexRef = useRef<number | null>(null);
  const mentionQueryRef = useRef("");
  const referencePicker = useBlockReferencePicker();

  const clearInlineMention = () => {
    mentionStartIndexRef.current = null;
    mentionQueryRef.current = "";
  };

  const insertInlineMention = (item: LinkableItem, searchQuery?: string) => {
    const mentionStart = mentionStartIndexRef.current;
    if (mentionStart === null) return;
    const activeQuery = mentionQueryRef.current || searchQuery || "";
    const replacement = `@${item.name}`;

    setNewComment((currentValue) => {
      const safeStart = Math.min(Math.max(mentionStart, 0), currentValue.length);
      const safeEnd = Math.min(currentValue.length, safeStart + 1 + activeQuery.length);
      return currentValue.slice(0, safeStart) + replacement + currentValue.slice(safeEnd);
    });

    clearInlineMention();
    requestAnimationFrame(() => {
      if (!commentInputRef.current) return;
      const cursorPosition = mentionStart + replacement.length;
      commentInputRef.current.focus();
      commentInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const closeInlineMentionPicker = () => {
    clearInlineMention();
    referencePicker?.closePicker();
  };

  const startReply = (commentId: string, authorDisplay: string) => {
    closeInlineMentionPicker();
    const initialDraft = `@${authorDisplay} `;
    setReplyTarget({ id: commentId, authorDisplay });
    setShowCommentInput(true);
    setNewComment(initialDraft);

    requestAnimationFrame(() => {
      if (!commentInputRef.current) return;
      const cursorPosition = initialDraft.length;
      commentInputRef.current.focus();
      commentInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  // Load current user and comments on mount
  useEffect(() => {
    const loadUserAndComments = async () => {
      try {
        // Load current user
        if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log("[PERF] client block-comments getCurrentUser");
        const response = await fetch("/api/auth/current-user", { cache: "no-store" });
        const userResult = await response.json();
        if (response.ok && userResult?.data) {
          setCurrentUser({
            id: userResult.data.id,
            email: userResult.data.email || undefined,
            name: userResult.data.name || undefined,
          });
        }
      } catch (error) {
        console.error("Failed to load current user:", error);
      }

      // Load comments from block content
      const blockContent = block.content || {};
      const storedComments = blockContent._blockComments || [];
      setComments(storedComments);
    };

    loadUserAndComments();
  }, [block.id, block.content]);

  const addComment = async () => {
    const commentText = newComment.trim();
    if (!commentText) return;
    closeInlineMentionPicker();

    // Load currentUser if not already loaded
    let user = currentUser;
    if (!user) {
      try {
        if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log("[PERF] client block-comments getCurrentUser");
        const response = await fetch("/api/auth/current-user", { cache: "no-store" });
        const userResult = await response.json();
        if (response.ok && userResult?.data) {
          user = {
            id: userResult.data.id,
            email: userResult.data.email || undefined,
            name: userResult.data.name || undefined,
          };
          setCurrentUser(user);
        } else {
          alert("Unable to load user information. Please refresh and try again.");
          return;
        }
      } catch (error) {
        console.error("Failed to load current user:", error);
        alert("Unable to load user information. Please refresh and try again.");
        return;
      }
    }

    if (!user) return;

    const createdAt = new Date().toISOString();
    const newCommentObj: BlockComment = {
      id: `comment-${user.id}-${createdAt}-${comments.length + 1}`,
      author_id: user.id,
      author_name: user.name || user.email?.split("@")[0] || "User",
      author_email: user.email,
      text: commentText,
      timestamp: createdAt,
    };

    const updatedComments = [...comments, newCommentObj];
    const blockContent = { ...block.content, _blockComments: updatedComments };

    // Optimistic update
    setComments(updatedComments);
    setNewComment("");
    setReplyTarget(null);
    setShowCommentInput(false);
    setIsExpanded(true);

    // Scroll to bottom to show new comment (after a brief delay to allow DOM update)
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 50);
    });

    // Update block
    if (block.id.startsWith("temp-")) {
      // Block not yet saved, just update local state
      onUpdate?.({
        ...block,
        content: blockContent,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    setIsLoading(true);
    const result = await updateBlock({
      blockId: block.id,
      content: blockContent,
    });

    setIsLoading(false);
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to add comment:", result.error);
      // Revert optimistic update
      setComments(comments);
      setNewComment(commentText); // Restore comment text on error
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!currentUser) return;

    const comment = comments.find((c) => c.id === commentId);
    const isExternal = comment?.source === "external";
    const isOwn = comment && currentUser && comment.author_id === currentUser.id;
    if (!isExternal && !isOwn) {
      return;
    }

    const updatedComments = comments.filter((c) => c.id !== commentId);
    const blockContent = { ...block.content, _blockComments: updatedComments };

    // Optimistic update
    const previousComments = [...comments];
    setComments(updatedComments);

    // Update block
    if (block.id.startsWith("temp-")) {
      onUpdate?.({
        ...block,
        content: blockContent,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    setIsLoading(true);
    const result = await updateBlock({
      blockId: block.id,
      content: blockContent,
    });

    setIsLoading(false);
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to delete comment:", result.error);
      // Revert optimistic update
      setComments(previousComments);
    }
  };

  const commentCount = comments.length;
  const hasComments = commentCount > 0;

  // Don't render anything if there are no comments and not forced open
  if (!hasComments && !isExpanded && externalIsOpen === undefined) {
    return null;
  }

  // Don't render anything if not expanded (sidebar should disappear when collapsed)
  if (!isExpanded && externalIsOpen === undefined) {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const floatingStyle = getFixedSidePanelPosition(anchorRect, side);

  return createPortal(
    <div
      className={cn(
        "fixed z-[140] w-[320px] max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-popover flex flex-col max-h-[min(72vh,560px)]"
      )}
      style={floatingStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--foreground)]">
          {commentCount === 0 ? "Comments" : `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeInlineMentionPicker();
            setIsExpanded(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div
        ref={commentsContainerRef}
        className="flex-1 min-h-0 space-y-2 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto', cursor: 'default' }}
      >
          {/* Existing comments */}
          {hasComments && (
            <div 
              className="space-y-1.5 w-full"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {comments.map((comment) => {
                const isOwnComment = currentUser && comment.author_id === currentUser.id;
                const isExternal = comment.source === "external";
                const canDelete = isExternal || Boolean(isOwnComment);
                // Always show the saved author name, fallback to email, then "Unknown"
                const authorDisplay = comment.author_name || comment.author_email?.split("@")[0] || "Unknown";
                const timeAgo = getTimeAgo(new Date(comment.timestamp));

                return (
                  <div
                    key={comment.id}
                    className="group/comment relative rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs w-full"
                  >
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {/* Velvet Purple avatar initial */}
                          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-[var(--velvet-purple)]/15 text-[var(--velvet-purple)] text-[9px] font-semibold flex-shrink-0">
                            {(isOwnComment ? "Y" : authorDisplay.charAt(0).toUpperCase())}
                          </span>
                          <span className="font-medium text-[var(--foreground)] text-xs">
                            {isOwnComment ? "You" : authorDisplay}
                          </span>
                          {isExternal && (
                            <span className="text-[9px] uppercase tracking-wide rounded-full bg-blue-50 text-blue-700 px-1.5 py-0.5">
                              Client
                            </span>
                          )}
                          <span className="text-[var(--tertiary-foreground)] text-xs font-normal">{timeAgo}</span>
                        </div>
                        <p className="text-[var(--muted-foreground)] leading-normal whitespace-pre-wrap break-words text-xs font-normal">
                          {comment.text}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startReply(comment.id, authorDisplay);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover/comment:opacity-100 text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-opacity"
                          title={`Reply to ${authorDisplay}`}
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteComment(comment.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={isLoading}
                            className="opacity-0 group-hover/comment:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity"
                            title="Delete comment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add comment form */}
          <div 
            className="pt-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {!showCommentInput ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCommentInput(true);
                  requestAnimationFrame(() => {
                    commentInputRef.current?.focus();
                  });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 hover:bg-[var(--surface-hover)]/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>{hasComments ? "Reply" : "Add a comment"}</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                {replyTarget && (
                  <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-1">
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      Replying to <span className="font-medium text-[var(--foreground)]">{replyTarget.authorDisplay}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyTarget(null);
                        setNewComment("");
                        closeInlineMentionPicker();
                        requestAnimationFrame(() => {
                          commentInputRef.current?.focus();
                        });
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                      title="Cancel reply"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNewComment(nextValue);

                    const mentionStart = mentionStartIndexRef.current;
                    if (mentionStart === null || !referencePicker) return;

                    const cursorPosition = e.currentTarget.selectionStart ?? nextValue.length;
                    const shouldStopMentioning =
                      mentionStart >= nextValue.length ||
                      nextValue[mentionStart] !== "@" ||
                      cursorPosition <= mentionStart;

                    if (shouldStopMentioning) {
                      closeInlineMentionPicker();
                      return;
                    }

                    const nextQuery = nextValue.slice(mentionStart + 1, cursorPosition);
                    mentionQueryRef.current = nextQuery;
                    referencePicker.updateQuery?.(nextQuery);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      addComment();
                      return;
                    }
                    if (e.key === "@" && referencePicker) {
                      e.preventDefault();
                      e.stopPropagation();
                      const currentValue = e.currentTarget.value;
                      const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
                      const selectionEnd = e.currentTarget.selectionEnd ?? selectionStart;
                      const nextValue =
                        currentValue.slice(0, selectionStart) + "@" + currentValue.slice(selectionEnd);

                      setNewComment(nextValue);
                      mentionStartIndexRef.current = selectionStart;
                      mentionQueryRef.current = "";

                      requestAnimationFrame(() => {
                        if (!commentInputRef.current) return;
                        const nextCursor = selectionStart + 1;
                        commentInputRef.current.focus();
                        commentInputRef.current.setSelectionRange(nextCursor, nextCursor);
                        const getAnchorRect = () =>
                          commentInputRef.current
                            ? getTextareaCaretRect(commentInputRef.current) ?? commentInputRef.current.getBoundingClientRect()
                            : null;
                        referencePicker.openPicker({
                          initialQuery: "",
                          anchorRect: getAnchorRect(),
                          getAnchorRect,
                          onSelect: insertInlineMention,
                          onClose: clearInlineMention,
                        });
                      });
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeInlineMentionPicker();
                      setReplyTarget(null);
                      setNewComment("");
                      setShowCommentInput(false);
                      return;
                    }
                    // Stop propagation to prevent drag listeners from interfering
                    e.stopPropagation();
                  }}
                  onKeyUp={(e) => {
                    e.stopPropagation();
                  }}
                  onInput={(e) => {
                    e.stopPropagation();
                  }}
                  onCompositionStart={(e) => {
                    e.stopPropagation();
                  }}
                  onCompositionEnd={(e) => {
                    e.stopPropagation();
                  }}
                  placeholder="Write a comment..."
                  className="w-full min-h-[50px] rounded-md border border-[var(--border)] bg-[var(--surface-hover)]/50 px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:border-[var(--foreground)]/20 focus:bg-[var(--surface)] resize-none transition-colors"
                  rows={2}
                  disabled={!currentUser || isLoading}
                  style={{ pointerEvents: 'auto', cursor: 'text' }}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
    </div>,
    document.body
  );
}

function getFixedSidePanelPosition(anchorRect: DOMRect | null, side: "left" | "right"): CSSProperties {
  const edgeMargin = 8;
  const gap = 12;
  const panelWidth = 320;
  const panelHeight = 420;
  const minTop = 72;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = edgeMargin;
  if (anchorRect) {
    left = side === "right"
      ? anchorRect.right + gap
      : anchorRect.left - panelWidth - gap;
  } else if (side === "right") {
    left = viewportWidth - panelWidth - edgeMargin;
  }

  const maxLeft = Math.max(edgeMargin, viewportWidth - panelWidth - edgeMargin);
  left = Math.min(Math.max(edgeMargin, left), maxLeft);

  const rawTop = anchorRect ? anchorRect.top - 12 : minTop;
  const maxTop = Math.max(minTop, viewportHeight - panelHeight - edgeMargin);
  const top = Math.min(Math.max(minTop, rawTop), maxTop);

  return { top: `${top}px`, left: `${left}px` };
}

function getTextareaCaretRect(textarea: HTMLTextAreaElement): DOMRect | null {
  const selectionStart = textarea.selectionStart ?? 0;
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);

  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.top = `${rect.top}px`;
  mirror.style.left = `${rect.left}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.overflow = "hidden";

  mirror.textContent = textarea.value.slice(0, selectionStart);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  const lineHeight = Number.parseFloat(style.lineHeight) || 16;
  const caretRect = new DOMRect(
    markerRect.left - textarea.scrollLeft,
    markerRect.top - textarea.scrollTop,
    1,
    lineHeight
  );

  if (
    !Number.isFinite(caretRect.top) ||
    !Number.isFinite(caretRect.left) ||
    (caretRect.top === 0 && caretRect.left === 0 && caretRect.width === 0 && caretRect.height === 0)
  ) {
    return null;
  }

  return caretRect;
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
    return `${diffInHours}${diffInHours === 1 ? " hour" : " hours"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}${diffInDays === 1 ? " day" : " days"} ago`;
  }

  // For older comments, show date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
