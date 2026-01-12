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
  const str = String(value);
  
  // If already in YYYY-MM-DD format, use it directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Otherwise parse as date and format in local timezone
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  
  // Format as YYYY-MM-DD in local timezone to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // Format date for display without timezone conversion
  const display = draft ? (() => {
    const [year, month, day] = draft.split("-").map(Number);
    if (!year || !month || !day) return "";
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString();
  })() : "";

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
