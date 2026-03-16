"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Plus, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useTaskReferences, useSubtaskReferences, useDeleteTaskReference, useDeleteSubtaskReference } from "@/lib/hooks/use-task-queries";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import { useUser } from "@/hooks/use-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCommentText(text: string): string {
  const html = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" title="${safeLabel}" data-ref-link="true" class="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">${safeLabel}</a>`;
  });
  return sanitizeHtml(html);
}

/** Parse "[label](url)" to { label, href }; return null if not a link. */
function parseCommentLinkMarkdown(text: string): { label: string; href: string } | null {
  const m = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  return m ? { label: m[1], href: m[2] } : null;
}

/** Build submitted comment text from display draft + mention spans (so input shows only names, not URLs). */
function buildCommentWithLinks(
  draft: string,
  spans: Array<{ start: number; end: number; href: string; label: string }>
): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let last = 0;
  for (const span of sorted) {
    parts.push(draft.slice(last, span.start));
    parts.push(`[${span.label}](${span.href})`);
    last = span.end;
  }
  parts.push(draft.slice(last));
  return parts.join("");
}

interface TaskDetailCardProps {
  variant: "task" | "subtask";
  task: {
    id: string | number;
    text: string;
    description?: string | null;
    statuses?: Array<{ field_name: string; value: string }>;
    assignees?: string[];
    dueDate?: string | null;
    dueTime?: string | null;
    dueTimeEnd?: string | null;
    comments?: Array<{ id: string | number; author: string; text: string; timestamp: string; parentId?: string | null }>;
  };
  statusBadge: React.ReactNode;
  /** Optional priority badge (with colors). Shown next to status when present. */
  priorityBadge?: React.ReactNode;
  assigneeLabel: string | null;
  assigneeInitial?: string | null;
  onClose: () => void;
  /** When true, card renders inside the block (narrow layout). */
  insideBlock?: boolean;
  /** Callback to open reference picker (Attachments only). Notes use onAddNote. */
  onAddReference?: (anchorRect?: DOMRect, mode?: "notes" | "attachments") => void;
  /** Callback to add a text note (stored as a comment with [note] prefix). */
  onAddNote?: (text: string) => void | Promise<void>;
  /** Callback to add a comment. For subtasks, parentTaskId is used. */
  onAddComment?: (text: string, parentId?: string | null) => void | Promise<void>;
  /** Open @ mention picker for the comment input (same as gallery). getAnchorRect() returns current caret rect for re-anchoring; onInsert(text) inserts the chosen mention. */
  onOpenCommentMentionPicker?: (
    anchorRect: DOMRect | null,
    getAnchorRect: () => DOMRect | null,
    onInsert: (text: string) => void
  ) => void;
  /** Used by the card to build getAnchorRect for the picker (caret position). Pass the same helper used for list view. */
  getTextareaCaretRect?: (textarea: HTMLTextAreaElement) => DOMRect | null;
  /** Called when user types after @ so the picker query can be updated (same as gallery). */
  onCommentMentionQueryChange?: (query: string) => void;
  /** Called when cursor leaves @ range so the picker can close (same as gallery). */
  onCloseCommentMentionPicker?: () => void;
  /** When true, hide add buttons (e.g. read-only or temp block). */
  disabled?: boolean;
  /** For subtasks: parent task id (for comment creation). */
  parentTaskId?: string;
  focusCommentId?: string | null;
  className?: string;
}

/** Formats date and time for display (e.g. "June 11 — 9:00 AM"). */
function formatDateAndTime(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined
): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (isNaN(date.getTime())) return null;
  const dateStr = format(date, "MMMM d");
  if (dueTime) {
    const timeMatch = dueTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const min = timeMatch[2];
      const ampm = hour >= 12 ? "PM" : "AM";
      const h = hour % 12 || 12;
      return `${dateStr} — ${h}:${min} ${ampm}`;
    }
  }
  return dateStr;
}

const SUBTASK_COMMENT_PREFIX = /^\[subtask:([^\]]+)\]\s*/i;
const NOTE_PREFIX = "[note] ";

function stripSubtaskPrefix(text: string): string {
  return text.replace(SUBTASK_COMMENT_PREFIX, "").trim() || text;
}

function isNoteComment(text: string): boolean {
  return text.startsWith(NOTE_PREFIX);
}

function stripNotePrefix(text: string): string {
  return text.startsWith(NOTE_PREFIX) ? text.slice(NOTE_PREFIX.length).trim() : text;
}

function buildCommentChildren<T extends { id: string | number; parentId?: string | null }>(comments: T[]) {
  const map = new Map<string, T[]>();
  for (const comment of comments) {
    const key = comment.parentId ? String(comment.parentId) : "root";
    const list = map.get(key) ?? [];
    list.push(comment);
    map.set(key, list);
  }
  return map;
}

export function TaskDetailCard({
  variant,
  task,
  statusBadge,
  priorityBadge,
  assigneeLabel,
  assigneeInitial,
  onClose,
  insideBlock = false,
  onAddReference,
  onAddNote,
  onAddComment,
  onOpenCommentMentionPicker,
  getTextareaCaretRect,
  onCommentMentionQueryChange,
  onCloseCommentMentionPicker,
  disabled = false,
  parentTaskId,
  focusCommentId,
  className,
}: TaskDetailCardProps) {
  const taskRefs = useTaskReferences(variant === "task" ? String(task.id) : undefined);
  const subtaskRefs = useSubtaskReferences(variant === "subtask" ? String(task.id) : undefined);
  const deleteTaskRefMutation = useDeleteTaskReference(variant === "task" ? String(task.id) : undefined);
  const deleteSubtaskRefMutation = useDeleteSubtaskReference(variant === "subtask" ? String(task.id) : undefined);
  const references = variant === "task" ? (taskRefs.data ?? []) : (subtaskRefs.data ?? []);
  const deleteRefMutation = variant === "task" ? deleteTaskRefMutation : deleteSubtaskRefMutation;

  const handleDeleteReference = async (refId: string) => {
    await deleteRefMutation.mutateAsync(refId);
  };

  const notes = references.filter((r) => r.reference_type === "file");
  const attachments = references.filter((r) => r.reference_type !== "file");
  const allComments = task.comments || [];
  const textNotes = allComments.filter((c) => isNoteComment(stripSubtaskPrefix(c.text)));
  const comments = allComments.filter((c) => !isNoteComment(stripSubtaskPrefix(c.text)));
  const dateTimeLabel = formatDateAndTime(task.dueDate ?? null, task.dueTime ?? null);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const commentsByParent = buildCommentChildren(comments);
  const replyTarget = replyTargetId ? comments.find((comment) => String(comment.id) === replyTargetId) ?? null : null;
  const [commentMentionSpans, setCommentMentionSpans] = useState<
    Array<{ start: number; end: number; href: string; label: string }>
  >([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentMentionStartRef = useRef<number | null>(null);
  const commentMentionEndRef = useRef<number | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const referencePicker = useBlockReferencePicker();
  const { data: currentUser } = useUser();
  const currentUserInitial = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? "?";

  /** Auto-grow notes textarea to fit content, capped so card never exceeds block. */
  const NOTES_TEXTAREA_MAX_HEIGHT_PX = 200;
  useEffect(() => {
    const el = noteTextareaRef.current;
    if (!el || !onAddNote) return;
    el.style.height = "auto";
    const capped = Math.min(el.scrollHeight, NOTES_TEXTAREA_MAX_HEIGHT_PX);
    el.style.height = `${capped}px`;
  }, [noteDraft, onAddNote]);

  /** Auto-grow comment textarea; scroll only when content exceeds max (card at max height). */
  const COMMENT_TEXTAREA_MAX_HEIGHT_PX = 200;
  useEffect(() => {
    const el = commentInputRef.current;
    if (!el || !onAddComment) return;
    el.style.height = "auto";
    const capped = Math.min(el.scrollHeight, COMMENT_TEXTAREA_MAX_HEIGHT_PX);
    el.style.height = `${capped}px`;
  }, [commentDraft, onAddComment]);

  useEffect(() => {
    if (!focusCommentId) return;
    const element = document.getElementById(`comment-${focusCommentId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusCommentId, task.comments]);

  const handleAddComment = async () => {
    const text = buildCommentWithLinks(commentDraft, commentMentionSpans).trim();
    if (!text || !onAddComment) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(text, replyTargetId);
      setCommentDraft("");
      setCommentMentionSpans([]);
      setReplyTargetId(null);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddNote = async () => {
    const text = noteDraft.trim();
    if (!text || !onAddNote) return;
    setIsSubmittingNote(true);
    try {
      await onAddNote(text);
      setNoteDraft("");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const canAdd = !disabled && (onAddReference || onAddNote || onAddComment);

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden relative flex flex-col h-full max-h-full",
        insideBlock ? "w-full max-w-[320px]" : "w-[340px] min-w-[300px]",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-3 right-4 p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors z-10"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pl-4 pr-5 pt-4 pb-2 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--foreground)] leading-tight">
            {task.text || "Untitled task"}
          </h3>
          {variant === "subtask" && (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Subtask</p>
          )}
          {(dateTimeLabel || assigneeLabel) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
              {dateTimeLabel && <span>{dateTimeLabel}</span>}
              {dateTimeLabel && assigneeLabel && <span aria-hidden className="text-[var(--border)]">·</span>}
              {assigneeLabel && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10px] font-medium text-[var(--foreground)]"
                    aria-hidden
                  >
                    {assigneeInitial || assigneeLabel.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[var(--foreground)]">{assigneeLabel}</span>
                </div>
              )}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {statusBadge}
            {priorityBadge}
          </div>
        </div>

        {/* Scrollable content: Notes, Attachments, Description, Comments */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mt-1">
          {/* Notes (file references + text notes + continuous input) */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[var(--foreground)]">Notes</p>
            {(notes.length > 0 || textNotes.length > 0) && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 space-y-1 overflow-visible min-h-0 max-h-[none]">
                {notes.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between group/ref"
                  >
                    <span className="text-sm text-[var(--foreground)] truncate flex-1 min-w-0">
                      {ref.title}
                    </span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReference(ref.id);
                        }}
                        className="ml-2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-red-500 opacity-0 group-hover/ref:opacity-100 transition-opacity shrink-0"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {textNotes.map((c) => (
                  <div key={String(c.id)} className="text-sm text-[var(--foreground)]">
                    {stripNotePrefix(stripSubtaskPrefix(c.text))}
                  </div>
                ))}
              </div>
            )}
            {onAddNote && (
              <textarea
                ref={noteTextareaRef}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder="Write a note..."
                disabled={disabled}
                rows={1}
                className="w-full border-0 border-b border-[var(--border)] rounded-none bg-transparent px-0 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed resize-none min-h-[1.5rem] max-h-[200px] overflow-y-auto"
              />
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[var(--foreground)]">Description</p>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {comments.length === 1 ? "Comment" : "Comments"}
            </p>
            {comments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(commentsByParent.get("root") ?? []).map((rootComment) => {
                  const renderThread = (comment: typeof comments[number], depth = 0): React.ReactNode => {
                    const children = commentsByParent.get(String(comment.id)) ?? [];
                    return (
                      <div key={String(comment.id)} id={`comment-${comment.id}`} className={cn("space-y-2", depth > 0 && "ml-8")}>
                        <div className={cn("flex gap-2 rounded-md px-2 py-1.5", focusCommentId === String(comment.id) && "bg-[var(--surface-hover)]")}>
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10px] font-medium text-[var(--foreground)]"
                            aria-hidden
                          >
                            {(comment.author || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-[var(--foreground)]">{comment.author || "Unknown"}</p>
                              {canAdd && onAddComment && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTargetId(String(comment.id));
                                    setCommentDraft((prev) => prev || `@${comment.author || "Unknown"} `);
                                    requestAnimationFrame(() => commentInputRef.current?.focus());
                                  }}
                                  className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                >
                                  Reply
                                </button>
                              )}
                            </div>
                            <p
                              className="text-xs text-[var(--foreground)] mt-0.5 [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80"
                              dangerouslySetInnerHTML={{ __html: formatCommentText(stripSubtaskPrefix(comment.text)) }}
                            />
                          </div>
                        </div>
                        {children.map((child) => renderThread(child, depth + 1))}
                      </div>
                    );
                  };
                  return renderThread(rootComment);
                })}
              </div>
            )}
            {canAdd && onAddComment && (
              <div className="space-y-2 pt-1">
                {replyTarget && (
                  <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-1">
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      Replying to <span className="font-medium text-[var(--foreground)]">{replyTarget.author || "Unknown"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTargetId(null)}
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10px] font-medium text-[var(--foreground)]"
                    aria-hidden
                  >
                    {currentUserInitial}
                  </div>
                  <textarea
                    ref={commentInputRef}
                    value={commentDraft}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCommentDraft(next);
                      // Re-anchor mention spans after edit (find each label in new draft in order)
                      setCommentMentionSpans((prev) => {
                        const newSpans: Array<{ start: number; end: number; href: string; label: string }> = [];
                        let searchStart = 0;
                        for (const span of prev) {
                          const idx = next.indexOf(span.label, searchStart);
                          if (idx === -1) continue;
                          newSpans.push({
                            start: idx,
                            end: idx + span.label.length,
                            href: span.href,
                            label: span.label,
                          });
                          searchStart = idx + span.label.length;
                        }
                        return newSpans;
                      });

                      const mentionStart = commentMentionStartRef.current;
                      if (mentionStart === null || (!onCommentMentionQueryChange && !onCloseCommentMentionPicker)) return;

                      const cursorPosition = e.currentTarget.selectionStart ?? next.length;
                      const shouldStopMentioning =
                        mentionStart >= next.length ||
                        next[mentionStart] !== "@" ||
                        cursorPosition <= mentionStart;

                      if (shouldStopMentioning) {
                        commentMentionStartRef.current = null;
                        commentMentionEndRef.current = null;
                        onCloseCommentMentionPicker?.();
                        return;
                      }

                      commentMentionEndRef.current = cursorPosition;
                      const nextQuery = next.slice(mentionStart + 1, cursorPosition);
                      onCommentMentionQueryChange?.(nextQuery);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (referencePicker?.isOpen) return;
                        e.preventDefault();
                        handleAddComment();
                        return;
                      }
                      if (e.key === "@" && onOpenCommentMentionPicker && getTextareaCaretRect) {
                        e.preventDefault();
                        const current = e.currentTarget.value;
                        const start = e.currentTarget.selectionStart ?? current.length;
                        const end = e.currentTarget.selectionEnd ?? start;
                        const next = current.slice(0, start) + "@" + current.slice(end);
                        setCommentDraft(next);
                        commentMentionStartRef.current = start;
                        commentMentionEndRef.current = start + 1;
                        const anchorRect = getTextareaCaretRect(e.currentTarget) ?? e.currentTarget.getBoundingClientRect();
                        const getAnchorRect = () =>
                          commentInputRef.current
                            ? getTextareaCaretRect(commentInputRef.current) ?? commentInputRef.current.getBoundingClientRect()
                            : null;
                        onOpenCommentMentionPicker(anchorRect, getAnchorRect, (text) => {
                          const s = commentMentionStartRef.current;
                          if (s === null) return;
                          const endIdx = commentMentionEndRef.current ?? s + 1;
                          const link = parseCommentLinkMarkdown(text);
                          const labelOnly = link ? link.label : text;
                          setCommentDraft((prev) => prev.slice(0, s) + labelOnly + prev.slice(endIdx));
                          if (link) {
                            setCommentMentionSpans((prev) =>
                              [...prev, { start: s, end: s + labelOnly.length, href: link.href, label: link.label }].sort(
                                (a, b) => a.start - b.start
                              )
                            );
                          }
                          commentMentionStartRef.current = null;
                          commentMentionEndRef.current = null;
                          requestAnimationFrame(() => {
                            commentInputRef.current?.focus();
                            const pos = s + labelOnly.length;
                            commentInputRef.current?.setSelectionRange(pos, pos);
                          });
                        });
                      }
                    }}
                    placeholder="Write a comment..."
                    rows={1}
                    style={{ maxHeight: COMMENT_TEXTAREA_MAX_HEIGHT_PX }}
                    className="flex-1 border-0 border-b border-[var(--border)] rounded-none bg-transparent px-0 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] resize-none min-h-[1.5rem] overflow-y-auto"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddComment();
                    }}
                    disabled={!commentDraft.trim() || isSubmittingComment}
                    className="shrink-0 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attachments: paperclip at bottom (aligned with X above) */}
        {canAdd && onAddReference && (
          <div className="flex justify-end pt-1.5 pb-0.5 border-t border-[var(--border)] mt-1.5">
            {attachments.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={attachmentButtonRef}
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                    aria-label="Attachments"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      const rect = attachmentButtonRef.current?.getBoundingClientRect();
                      if (rect) onAddReference(rect, "attachments");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Add attachment
                  </DropdownMenuItem>
                  {attachments.length > 0 && <DropdownMenuSeparator />}
                  {attachments.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between gap-2 min-w-0 px-3 py-2 text-sm text-[var(--foreground)]"
                    >
                      <span className="truncate flex-1">{ref.title}</span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteReference(ref.id);
                          }}
                          className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-red-500 shrink-0"
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                ref={attachmentButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  onAddReference(rect, "attachments");
                }}
                className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Add attachment"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
