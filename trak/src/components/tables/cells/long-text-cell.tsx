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
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [localExpanded, setLocalExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cellExpanded = expanded ?? localExpanded;
  const isExpanded = Boolean(forceExpanded || cellExpanded);

  const requestContentResize = useCallback(() => {
    window.requestAnimationFrame(() => onContentResize?.());
  }, [onContentResize]);

  useEffect(() => {
    requestContentResize();
  }, [forceExpanded, requestContentResize]);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    if (initialValue === undefined || initialValue === null) return;
    setDraft(initialValue);
  }, [editing, initialValue]);

  // Auto-resize on content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
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
            setDraft(String(value ?? ""));
            onCancel();
          }
        }}
        placeholder="Type text... (Cmd/Ctrl+Enter to save)"
      />
    );
  }

  const displayText = String(value ?? "");

  return (
    <button
      className={`block w-full text-left text-xs text-[var(--foreground)] min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 ${
        isExpanded ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : "truncate whitespace-nowrap"
      }`}
      onClick={() => {
        if (forceExpanded) return;
        if (onToggleExpanded) {
          onToggleExpanded();
        } else {
          setLocalExpanded((current) => !current);
        }
        requestContentResize();
      }}
      onDoubleClick={() => {
        if (!onToggleExpanded) setLocalExpanded(false);
        requestContentResize();
        onStartEdit();
      }}
      disabled={saving}
      title={displayText}
      aria-expanded={isExpanded}
    >
      {displayText || <span className="text-[var(--muted-foreground)]">Empty</span>}
    </button>
  );
}
