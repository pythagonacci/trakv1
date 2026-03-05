"use client";

import { useState, useEffect, useRef } from "react";
import { type Block, updateBlock } from "@/app/actions/block";
import { cn } from "@/lib/utils";

export interface SectionHeaderBlockProps {
  /** When used in BlockRenderer, pass the block and title/subtitle are read from block.content. */
  block: Block;
  /** Optional class name for the root wrapper (e.g. for spacing when used outside block system). */
  className?: string;
  /** When provided and not readOnly, title/subtitle are editable on click. */
  onUpdate?: (updatedBlock?: Block) => void;
  readOnly?: boolean;
}

/**
 * Section Header block: a lightweight structural divider for Project Pages.
 * Displays a title (required) and optional subtitle. No actions, buttons, or icons.
 * Use between blocks to create visual sections (e.g. "Vendors & Logistics", "Content Calendar").
 *
 * @example
 * // Rendered via BlockRenderer when block.type === "section_header"
 * <SectionHeaderBlock block={block} onUpdate={onUpdate} />
 *
 * @example
 * // Example content for 2–3 section headers on a page:
 * // Block 1: content: { title: "Vendors & Logistics", subtitle: "Contacts and delivery windows" }
 * // Block 2: content: { title: "Content Calendar", subtitle: "" }
 * // Block 3: content: { title: "PR List" }
 */
export default function SectionHeaderBlock({ block, className, onUpdate, readOnly = false }: SectionHeaderBlockProps) {
  const content = (block.content ?? {}) as { title?: string; subtitle?: string };
  const [titleValue, setTitleValue] = useState(typeof content.title === "string" ? content.title : "");
  const [subtitleValue, setSubtitleValue] = useState(typeof content.subtitle === "string" ? content.subtitle : "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleValue(typeof content.title === "string" ? content.title : "");
  }, [content.title]);
  useEffect(() => {
    setSubtitleValue(typeof content.subtitle === "string" ? content.subtitle : "");
  }, [content.subtitle]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingSubtitle) subtitleInputRef.current?.focus();
  }, [editingSubtitle]);

  const canEdit = Boolean(onUpdate) && !readOnly;

  const saveTitle = async () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed === (content.title ?? "")) return;
    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, title: trimmed || "New Section" },
      });
      onUpdate?.();
    } catch (e) {
      console.error("SectionHeaderBlock saveTitle:", e);
    }
  };

  const saveSubtitle = async () => {
    setEditingSubtitle(false);
    const next = subtitleValue.trim();
    if (next === (content.subtitle ?? "")) return;
    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, subtitle: next || undefined },
      });
      onUpdate?.();
    } catch (e) {
      console.error("SectionHeaderBlock saveSubtitle:", e);
    }
  };

  return (
    <div className={cn("min-w-0", className)}>
      {/* A) Thin horizontal divider line above */}
      <div
        className="h-px bg-neutral-200/90 dark:bg-neutral-700/80"
        aria-hidden
      />
      {/* ~8px gap then compact container */}
      <div className="mt-2">
        {/* B) Container with optional C) left accent rail */}
        <div
          className={cn(
            "relative flex min-w-0 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80",
            "bg-white dark:bg-neutral-900/60",
            "shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:shadow-none",
            "py-3 pl-3 pr-3",
            // C) 3px left accent rail
            "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-l-xl before:bg-neutral-900/5 dark:before:bg-neutral-100/5"
          )}
        >
          <div className="min-w-0 flex-1">
            {/* Title: single line, truncate; click to edit when canEdit */}
            {editingTitle && canEdit ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveTitle();
                  }
                }}
                className={cn(
                  "w-full text-[13px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-100",
                  "bg-transparent border-none outline-none focus:ring-0 p-0"
                )}
                aria-label="Section title"
              />
            ) : (
              <h3
                className={cn(
                  "text-[13px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-100",
                  "truncate",
                  canEdit && "cursor-text"
                )}
                title={titleValue || undefined}
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {titleValue || " "}
              </h3>
            )}
            {/* Subtitle: wrap, max 2 lines; click to edit when canEdit */}
            {editingSubtitle && canEdit ? (
              <textarea
                ref={subtitleInputRef}
                value={subtitleValue}
                onChange={(e) => setSubtitleValue(e.target.value)}
                onBlur={saveSubtitle}
                rows={2}
                className={cn(
                  "mt-0.5 w-full resize-none text-xs text-neutral-500 dark:text-neutral-400 leading-5",
                  "bg-transparent border-none outline-none focus:ring-0 p-0"
                )}
                aria-label="Section subtitle"
              />
            ) : (
              (subtitleValue !== "" || canEdit) && (
                <p
                  className={cn(
                    "mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 leading-5",
                    "line-clamp-2 min-h-[1.25rem]",
                    canEdit && "cursor-text"
                  )}
                  onClick={() => canEdit && setEditingSubtitle(true)}
                >
                  {subtitleValue || (canEdit ? " " : null)}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
