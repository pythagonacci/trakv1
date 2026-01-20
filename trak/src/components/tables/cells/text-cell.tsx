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

export function TextCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue }: Props) {
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    if (initialValue === undefined || initialValue === null) return;
    setDraft(initialValue);
  }, [editing, initialValue]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === "Escape") {
            setDraft(String(value ?? ""));
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <button
      className="w-full text-left text-sm text-[var(--foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
      onClick={onStartEdit}
      disabled={saving}
    >
      {String(value ?? "")}
    </button>
  );
}
