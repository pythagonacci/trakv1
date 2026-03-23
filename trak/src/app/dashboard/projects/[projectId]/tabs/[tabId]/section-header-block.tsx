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
  const [editingField, setEditingField] = useState<"title" | "subtitle" | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLTextAreaElement>(null);
  const editingTitle = editingField === "title";
  const editingSubtitle = editingField === "subtitle";
  const canEdit = !readOnly;
  const hasSubtitle = subtitleValue.trim() !== "";
  const showSubtitleSlot = hasSubtitle || (canEdit && editingField !== null);

  useEffect(() => {
    setTitleValue(typeof content.title === "string" ? content.title : "");
  }, [content.title]);
  useEffect(() => {
    setSubtitleValue(typeof content.subtitle === "string" ? content.subtitle : "");
  }, [content.subtitle]);

  useEffect(() => {
    if (editingField === "title") {
      titleInputRef.current?.focus();
      return;
    }
    if (editingField === "subtitle") {
      subtitleInputRef.current?.focus();
    }
  }, [editingField]);

  const saveTitle = async () => {
    setEditingField((current) => (current === "title" ? null : current));
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
    setEditingField((current) => (current === "subtitle" ? null : current));
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

  const startTitleEdit = () => {
    if (!canEdit) return;
    setEditingField("title");
  };

  const startSubtitleEdit = (e?: React.MouseEvent<HTMLElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canEdit) return;
    if (titleValue.trim() === "") {
      setEditingField("title");
      return;
    }
    setEditingField("subtitle");
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="my-2 min-w-0">
        <div
          className="min-w-0"
          onClick={(e) => {
            if (!canEdit || editingField !== null) return;
            const target = e.target as HTMLElement;
            if (target.closest("input, textarea, button, a, [role='button'], [data-subtitle-click='true']")) {
              return;
            }
            startTitleEdit();
          }}
        >
          {/* Title: match project-name typography */}
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
                "w-full text-xl font-bold tracking-normal text-[var(--foreground)]",
                "bg-transparent border-none outline-none focus:ring-0 p-0"
              )}
              aria-label="Section title"
            />
          ) : (
            <h3
              className={cn(
                "text-xl font-bold tracking-normal text-[var(--foreground)]",
                "truncate",
                canEdit && "cursor-text"
              )}
              title={titleValue || undefined}
              onClick={startTitleEdit}
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
                "mt-0.5 w-full resize-none text-sm leading-5 text-[var(--muted-foreground)]",
                "bg-transparent border-none outline-none focus:ring-0 p-0"
              )}
              aria-label="Section subtitle"
            />
          ) : showSubtitleSlot ? (
            <p
              data-subtitle-click="true"
              className={cn(
                "mt-0.5 text-sm leading-5",
                hasSubtitle
                  ? "line-clamp-2 text-[var(--muted-foreground)]"
                  : "text-[var(--tertiary-foreground)]",
                canEdit && "cursor-text"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => startSubtitleEdit(e)}
            >
              {hasSubtitle ? subtitleValue : "Add subtitle"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="h-px bg-[var(--border)]/45" aria-hidden />
    </div>
  );
}
