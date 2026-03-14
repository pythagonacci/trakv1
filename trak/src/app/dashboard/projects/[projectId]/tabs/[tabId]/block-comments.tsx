"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Plus, Reply, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type Block } from "@/app/actions/block";
import { createBlockComment, deleteBlockComment, listBlockComments } from "@/app/actions/block-comments";
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
  const [internalIsOpen, setInternalIsOpen] = useState(true);
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
  const searchParams = useSearchParams();
  const focusedCommentId = searchParams.get("commentId");

  const isExpanded = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsExpanded = (value: boolean) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(value);
    } else {
      onToggle?.();
    }
  };

  const syncBlockState = (nextComments: BlockComment[]) => {
    setComments(nextComments);
    onUpdate?.({
      ...block,
      content: { ...(block.content || {}), _blockComments: nextComments },
      updated_at: new Date().toISOString(),
    });
  };

  const clearInlineMention = () => {
    mentionStartIndexRef.current = null;
    mentionQueryRef.current = "";
  };

  const closeInlineMentionPicker = () => {
    clearInlineMention();
    referencePicker?.closePicker();
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

  const startReply = (commentId: string, authorDisplay: string) => {
    closeInlineMentionPicker();
    setReplyTarget({ id: commentId, authorDisplay });
    setShowCommentInput(true);
    setNewComment((current) => current || `@${authorDisplay} `);
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [userResponse, commentsResult] = await Promise.all([
          fetch("/api/auth/current-user", { cache: "no-store" }),
          listBlockComments(block.id),
        ]);
        const userResult = await userResponse.json();
        if (!cancelled && userResponse.ok && userResult?.data) {
          setCurrentUser({
            id: userResult.data.id,
            email: userResult.data.email || undefined,
            name: userResult.data.name || undefined,
          });
        }
        if (!cancelled && "data" in commentsResult) {
          setComments(commentsResult.data);
        }
      } catch (error) {
        console.error("Failed to load block comments", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [block.id]);

  useEffect(() => {
    if (!focusedCommentId) return;
    if (!comments.some((comment) => comment.id === focusedCommentId)) return;
    setShowCommentInput(true);
    const timer = setTimeout(() => {
      const element = document.getElementById(`comment-${focusedCommentId}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(timer);
  }, [comments, focusedCommentId]);

  const addComment = async () => {
    const commentText = newComment.trim();
    if (!commentText) return;
    if (block.id.startsWith("temp-")) {
      const createdAt = new Date().toISOString();
      const optimisticComment: BlockComment = {
        id: `comment-${currentUser?.id ?? "temp"}-${Date.now()}`,
        parent_id: replyTarget?.id ?? null,
        author_id: currentUser?.id ?? "temp-user",
        author_name: currentUser?.name || currentUser?.email?.split("@")[0] || "User",
        author_email: currentUser?.email,
        text: commentText,
        timestamp: createdAt,
        source: "internal",
      };
      syncBlockState([...comments, optimisticComment]);
      setNewComment("");
      setReplyTarget(null);
      setShowCommentInput(false);
      return;
    }

    setIsLoading(true);
    const result = await createBlockComment({
      blockId: block.id,
      text: commentText,
      parentId: replyTarget?.id ?? null,
    });
    setIsLoading(false);
    if ("error" in result) {
      console.error("Failed to add block comment", result.error);
      return;
    }

    syncBlockState(result.data);
    setNewComment("");
    setReplyTarget(null);
    setShowCommentInput(false);
    requestAnimationFrame(() => {
      if (commentsContainerRef.current) {
        commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
      }
    });
  };

  const removeComment = async (commentId: string) => {
    const comment = comments.find((entry) => entry.id === commentId);
    const isExternal = comment?.source === "external";
    const isOwn = currentUser && comment?.author_id === currentUser.id;
    if (!comment || (!isExternal && !isOwn)) return;

    if (block.id.startsWith("temp-")) {
      syncBlockState(comments.filter((entry) => entry.id !== commentId));
      return;
    }

    setIsLoading(true);
    const result = await deleteBlockComment(commentId);
    setIsLoading(false);
    if ("error" in result) {
      console.error("Failed to delete block comment", result.error);
      return;
    }
    syncBlockState(result.data);
  };

  const commentsByParent = useMemo(() => {
    const map = new Map<string, BlockComment[]>();
    for (const comment of comments) {
      const key = comment.parent_id ? String(comment.parent_id) : "root";
      const list = map.get(key) ?? [];
      list.push(comment);
      map.set(key, list);
    }
    return map;
  }, [comments]);

  const commentCount = comments.length;
  const hasComments = commentCount > 0;

  if (!hasComments && !isExpanded && externalIsOpen === undefined) return null;
  if (!isExpanded && externalIsOpen === undefined) return null;
  if (typeof window === "undefined") return null;

  const floatingStyle = getFixedSidePanelPosition(anchorRect, side);

  const renderComment = (comment: BlockComment, depth = 0): ReactElement => {
    const children = commentsByParent.get(comment.id) ?? [];
    const isOwnComment = currentUser && comment.author_id === currentUser.id;
    const isExternal = comment.source === "external";
    const canDelete = isExternal || Boolean(isOwnComment);
    const authorDisplay = comment.author_name || comment.author_email?.split("@")[0] || "Unknown";
    const timeAgo = getTimeAgo(new Date(comment.timestamp));

    return (
      <div key={comment.id} id={`comment-${comment.id}`} className={cn("space-y-1.5", depth > 0 && "ml-6")}>
        <div className={cn("group/comment relative rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs w-full", focusedCommentId === comment.id && "bg-[var(--surface-hover)]") }>
          <div className="flex items-start justify-between gap-1.5 w-full">
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-[var(--velvet-purple)]/15 text-[var(--velvet-purple)] text-[9px] font-semibold flex-shrink-0">
                  {(isOwnComment ? "Y" : authorDisplay.charAt(0).toUpperCase())}
                </span>
                <span className="font-medium text-[var(--foreground)] text-xs">{isOwnComment ? "You" : authorDisplay}</span>
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
                onClick={(event) => {
                  event.stopPropagation();
                  startReply(comment.id, authorDisplay);
                }}
                className="opacity-0 group-hover/comment:opacity-100 text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-opacity"
                title={`Reply to ${authorDisplay}`}
              >
                <Reply className="h-3 w-3" />
              </button>
              {canDelete && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    removeComment(comment.id);
                  }}
                  disabled={isLoading}
                  className="opacity-0 group-hover/comment:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity"
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        {children.map((child) => renderComment(child, depth + 1))}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed z-[140] w-[320px] max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-popover flex flex-col max-h-[min(72vh,560px)]"
      style={floatingStyle}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--foreground)]">
          {commentCount === 0 ? "Comments" : `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
        </span>
        <button
          onClick={(event) => {
            event.stopPropagation();
            closeInlineMentionPicker();
            setIsExpanded(false);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div ref={commentsContainerRef} className="flex-1 min-h-0 space-y-2 overflow-y-auto">
        {hasComments && <div className="space-y-1.5 w-full">{(commentsByParent.get("root") ?? []).map((comment) => renderComment(comment))}</div>}

        <div className="pt-1">
          {!showCommentInput ? (
            <button
              onClick={() => {
                setShowCommentInput(true);
                requestAnimationFrame(() => commentInputRef.current?.focus());
              }}
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
                    onClick={() => {
                      setReplyTarget(null);
                      setNewComment("");
                    }}
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
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNewComment(nextValue);

                  const mentionStart = mentionStartIndexRef.current;
                  if (mentionStart === null || !referencePicker) return;

                  const cursorPosition = event.currentTarget.selectionStart ?? nextValue.length;
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
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    addComment();
                    return;
                  }
                  if (event.key === "@" && referencePicker) {
                    event.preventDefault();
                    const currentValue = event.currentTarget.value;
                    const selectionStart = event.currentTarget.selectionStart ?? currentValue.length;
                    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
                    const nextValue = currentValue.slice(0, selectionStart) + "@" + currentValue.slice(selectionEnd);

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
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeInlineMentionPicker();
                    setReplyTarget(null);
                    setNewComment("");
                    setShowCommentInput(false);
                  }
                }}
                placeholder="Write a comment..."
                className="w-full min-h-[50px] rounded-md border border-[var(--border)] bg-[var(--surface-hover)]/50 px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:border-[var(--foreground)]/20 focus:bg-[var(--surface)] resize-none transition-colors"
                rows={2}
                disabled={!currentUser || isLoading}
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
    left = side === "right" ? anchorRect.right + gap : anchorRect.left - panelWidth - gap;
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
  const caretRect = new DOMRect(markerRect.left - textarea.scrollLeft, markerRect.top - textarea.scrollTop, 1, lineHeight);
  if (!Number.isFinite(caretRect.top) || !Number.isFinite(caretRect.left)) return null;
  return caretRect;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}${diffInMinutes === 1 ? " min" : " mins"} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}${diffInHours === 1 ? " hour" : " hours"} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}${diffInDays === 1 ? " day" : " days"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
