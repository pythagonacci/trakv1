"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { getCurrentUser } from "@/app/actions/auth";

interface BlockComment {
  id: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  text: string;
  timestamp: string;
}

interface BlockCommentsProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function BlockComments({ block, onUpdate, isOpen: externalIsOpen, onToggle }: BlockCommentsProps) {
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
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load current user and comments on mount
  useEffect(() => {
    const loadUserAndComments = async () => {
      try {
        // Load current user
        const userResult = await getCurrentUser();
        if (userResult.data) {
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
    if (!commentText || !currentUser) return;

    const newCommentObj: BlockComment = {
      id: `comment-${Date.now()}-${Math.random()}`,
      author_id: currentUser.id,
      author_name: currentUser.name,
      author_email: currentUser.email,
      text: commentText,
      timestamp: new Date().toISOString(),
    };

    const updatedComments = [...comments, newCommentObj];
    const blockContent = { ...block.content, _blockComments: updatedComments };

    // Optimistic update
    setComments(updatedComments);
    setNewComment("");
    setIsExpanded(true);

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
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!currentUser) return;

    const comment = comments.find((c) => c.id === commentId);
    // Only allow deleting own comments (or enhance with permissions later)
    if (comment && comment.author_id !== currentUser.id) return;

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

  // Show collapsed view with tiny square indicator (only if there are comments)
  if (!isExpanded && hasComments) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        title={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
      >
        {/* Tiny square indicator */}
        <div className="h-2 w-2 rounded-sm bg-[var(--primary)]" />
      </button>
    );
  }
  
  // Don't render anything if not expanded and no comments and not explicitly opened
  if (!isExpanded && !hasComments) {
    return null;
  }

  return (
    <div 
      className="w-64 flex-shrink-0 border-l border-[var(--border)] pl-3 ml-3"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {/* Tiny square indicator */}
          <div className="h-2 w-2 rounded-sm bg-[var(--primary)]" />
          <span className="text-xs font-medium text-[var(--foreground)]">
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>

      <div 
        className="space-y-2 max-h-[400px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto', cursor: 'default' }}
      >
          {/* Existing comments */}
          {hasComments && (
            <div 
              className="space-y-1.5"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {comments.map((comment) => {
                const isOwnComment = currentUser && comment.author_id === currentUser.id;
                const authorDisplay = comment.author_name || comment.author_email || "Unknown";
                const timeAgo = getTimeAgo(new Date(comment.timestamp));

                return (
                  <div
                    key={comment.id}
                    className="group/comment relative rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-[var(--foreground)] text-xs">
                            {isOwnComment ? "You" : authorDisplay}
                          </span>
                          <span className="text-[var(--tertiary-foreground)] text-xs">{timeAgo}</span>
                        </div>
                        <p className="text-[var(--muted-foreground)] leading-normal whitespace-pre-wrap break-words text-xs">
                          {comment.text}
                        </p>
                      </div>
                      {isOwnComment && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteComment(comment.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={isLoading}
                          className="opacity-0 group-hover/comment:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity flex-shrink-0"
                          title="Delete comment"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
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
            <textarea
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
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
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  e.stopPropagation();
                  addComment();
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setNewComment("");
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
              placeholder="Add comment... (Cmd/Ctrl + Enter)"
              className="w-full min-h-[50px] rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
              rows={2}
              disabled={!currentUser || isLoading}
              style={{ pointerEvents: 'auto', cursor: 'text' }}
            />
          </div>
        </div>
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
    return `${diffInHours}${diffInHours === 1 ? " hour" : " hours"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}${diffInDays === 1 ? " day" : " days"} ago`;
  }

  // For older comments, show date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

