"use client";

import { useState, useEffect, useRef } from "react";
import { type Block, updateBlock } from "@/app/actions/block";
import { cn } from "@/lib/utils";

/** Strong vertical bar colors (left accent before title). */
const SECTION_ACCENT_STYLES = {
  none: {
    barClass: "",
    swatchClass: "bg-[var(--border)] border border-[var(--border)]",
  },
  slate: {
    barClass: "bg-zinc-800 dark:bg-zinc-100",
    swatchClass: "bg-zinc-800 dark:bg-zinc-100",
  },
  amber: {
    barClass: "bg-amber-500",
    swatchClass: "bg-amber-500",
  },
  emerald: {
    barClass: "bg-emerald-600",
    swatchClass: "bg-emerald-600",
  },
  blue: {
    barClass: "bg-blue-600",
    swatchClass: "bg-blue-600",
  },
  rose: {
    barClass: "bg-rose-600",
    swatchClass: "bg-rose-600",
  },
  violet: {
    barClass: "bg-violet-600",
    swatchClass: "bg-violet-600",
  },
  orange: {
    barClass: "bg-orange-500",
    swatchClass: "bg-orange-500",
  },
  red: {
    barClass: "bg-red-600",
    swatchClass: "bg-red-600",
  },
} as const;

type SectionAccentKey = keyof typeof SECTION_ACCENT_STYLES;

const SECTION_ACCENT_OPTIONS: Array<{ key: SectionAccentKey; label: string }> = [
  { key: "none", label: "No bar" },
  { key: "slate", label: "Slate bar" },
  { key: "amber", label: "Amber bar" },
  { key: "emerald", label: "Green bar" },
  { key: "blue", label: "Blue bar" },
  { key: "rose", label: "Rose bar" },
  { key: "violet", label: "Violet bar" },
  { key: "orange", label: "Orange bar" },
  { key: "red", label: "Red bar" },
];

/** Legacy `highlight` keys from pastel block highlight → accent bar. */
const LEGACY_HIGHLIGHT_TO_ACCENT: Record<string, SectionAccentKey> = {
  none: "none",
  yellow: "amber",
  green: "emerald",
  blue: "blue",
  pink: "rose",
  purple: "violet",
};

function normalizeAccent(content: {
  accent?: string;
  highlight?: string;
}): SectionAccentKey {
  const raw = typeof content.accent === "string" ? content.accent : undefined;
  if (raw && raw in SECTION_ACCENT_STYLES) {
    return raw as SectionAccentKey;
  }
  const legacy = typeof content.highlight === "string" ? content.highlight : undefined;
  if (legacy && legacy in LEGACY_HIGHLIGHT_TO_ACCENT) {
    return LEGACY_HIGHLIGHT_TO_ACCENT[legacy]!;
  }
  // No accent saved yet: default strong neutral bar (not "none")
  return "slate";
}

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
  const content = (block.content ?? {}) as {
    title?: string;
    subtitle?: string;
    accent?: string;
    highlight?: string;
  };
  const [titleValue, setTitleValue] = useState(typeof content.title === "string" ? content.title : "");
  const [subtitleValue, setSubtitleValue] = useState(typeof content.subtitle === "string" ? content.subtitle : "");
  const [accentValue, setAccentValue] = useState<SectionAccentKey>(normalizeAccent(content));
  const [editingField, setEditingField] = useState<"title" | "subtitle" | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLTextAreaElement>(null);
  const editingTitle = editingField === "title";
  const editingSubtitle = editingField === "subtitle";
  const canEdit = !readOnly;
  const hasSubtitle = subtitleValue.trim() !== "";
  const showSubtitleSlot = hasSubtitle || (canEdit && editingField !== null);
  const showBar = accentValue !== "none";

  useEffect(() => {
    setTitleValue(typeof content.title === "string" ? content.title : "");
  }, [content.title]);
  useEffect(() => {
    setSubtitleValue(typeof content.subtitle === "string" ? content.subtitle : "");
  }, [content.subtitle]);
  useEffect(() => {
    setAccentValue(normalizeAccent(content));
  }, [content.accent, content.highlight]);

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
    const { highlight: _legacy, ...rest } = content;
    try {
      await updateBlock({
        blockId: block.id,
        content: { ...rest, title: trimmed || "New Section" },
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
    const { highlight: _legacy, ...rest } = content;
    try {
      await updateBlock({
        blockId: block.id,
        content: { ...rest, subtitle: next || undefined },
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

  const saveAccent = async (nextAccent: SectionAccentKey) => {
    if (nextAccent === accentValue) return;
    setAccentValue(nextAccent);
    const { highlight: _legacy, ...rest } = content;
    try {
      await updateBlock({
        blockId: block.id,
        content: {
          ...rest,
          accent: nextAccent,
        },
      });
      onUpdate?.();
    } catch (e) {
      console.error("SectionHeaderBlock saveAccent:", e);
      setAccentValue(normalizeAccent(content));
    }
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="my-2 min-w-0">
        <div className="flex min-w-0 gap-3">
          {showBar && (
            <div
              className={cn(
                "w-1.5 shrink-0 self-stretch rounded-sm",
                SECTION_ACCENT_STYLES[accentValue].barClass
              )}
              aria-hidden
            />
          )}
          <div
            className="min-w-0 flex-1"
            onClick={(e) => {
              if (!canEdit || editingField !== null) return;
              const target = e.target as HTMLElement;
              if (
                target.closest(
                  "input, textarea, button, a, [role='button'], [data-subtitle-click='true'], [data-accent-picker='true']"
                )
              ) {
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
            {canEdit && (
              <div
                data-accent-picker="true"
                className="mt-2 flex flex-wrap items-center gap-1.5"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {SECTION_ACCENT_OPTIONS.map((option) => {
                  const selected = accentValue === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={selected}
                      className={cn(
                        "h-4 w-4 rounded-full border border-black/10 transition-transform hover:scale-105 dark:border-white/10",
                        SECTION_ACCENT_STYLES[option.key].swatchClass,
                        selected && "ring-2 ring-[var(--foreground)] ring-offset-1"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void saveAccent(option.key);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-px bg-[var(--border)]/45" aria-hidden />
    </div>
  );
}
