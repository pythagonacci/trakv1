"use client";

import { useEffect, useRef, useState } from "react";
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
}

export function LongTextCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue }: Props) {
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1 resize-none overflow-hidden min-h-[60px]"
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
  const isMultiline = displayText.includes('\n');

  return (
    <button
      className={`w-full text-left text-sm text-[var(--foreground)] min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 ${
        isMultiline ? 'whitespace-pre-wrap' : 'truncate'
      }`}
      onClick={onStartEdit}
      disabled={saving}
    >
      {displayText || <span className="text-[var(--muted-foreground)]">Empty</span>}
    </button>
  );
}
