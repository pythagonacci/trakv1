"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type TableField } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  initialValue?: string | null;
  onContentResize?: () => void;
  forceExpanded?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function LongTextCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue, onContentResize, forceExpanded, expanded, onToggleExpanded }: Props) {
  const displayText = String(value ?? "");
  const editSeed = initialValue ?? displayText;
  const [draftState, setDraftState] = useState(() => ({
    seed: displayText,
    value: displayText,
  }));
  const [localExpanded, setLocalExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cellExpanded = expanded ?? localExpanded;
  const isExpanded = Boolean(forceExpanded || cellExpanded);
  const draft = editing && draftState.seed === editSeed ? draftState.value : editSeed;

  const updateDraft = useCallback((nextValue: string) => {
    setDraftState({
      seed: editSeed,
      value: nextValue,
    });
  }, [editSeed]);

  const resetDraft = useCallback(() => {
    setDraftState({
      seed: displayText,
      value: displayText,
    });
  }, [displayText]);

  const requestContentResize = useCallback(() => {
    window.requestAnimationFrame(() => onContentResize?.());
  }, [onContentResize]);

  useEffect(() => {
    requestContentResize();
  }, [forceExpanded, requestContentResize]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing]);

  // Auto-resize on content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateDraft(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1 resize-none overflow-hidden min-h-[60px]"
        value={draft}
        onChange={handleChange}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === "Escape") {
            resetDraft();
            onCancel();
          }
        }}
        placeholder="Type text... (Cmd/Ctrl+Enter to save)"
      />
    );
  }

  return (
    <button
      className={`block w-full text-left text-xs text-[var(--foreground)] min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 ${
        isExpanded ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : "truncate whitespace-nowrap"
      }`}
      onClick={() => {
        if (!displayText) {
          resetDraft();
          onStartEdit();
          return;
        }
        if (forceExpanded) return;
        if (onToggleExpanded) {
          onToggleExpanded();
        } else {
          setLocalExpanded((current) => !current);
        }
        requestContentResize();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!onToggleExpanded) setLocalExpanded(false);
        requestContentResize();
        resetDraft();
        onStartEdit();
      }}
      disabled={saving}
      title={displayText}
      aria-expanded={isExpanded}
    >
      {displayText}
    </button>
  );
}
