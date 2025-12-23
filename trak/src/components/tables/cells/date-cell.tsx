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
}

const toInputValue = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export function DateCell({ value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const [draft, setDraft] = useState<string>(toInputValue(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(toInputValue(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft || null);
          }
          if (e.key === "Escape") {
            setDraft(toInputValue(value));
            onCancel();
          }
        }}
      />
    );
  }

  const display = draft ? new Date(draft).toLocaleDateString() : "";

  return (
    <button
      className="w-full text-left text-sm text-[var(--foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
      onClick={onStartEdit}
      disabled={saving}
    >
      {display}
    </button>
  );
}
