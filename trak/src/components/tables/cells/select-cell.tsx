"use client";

import { useEffect, useState } from "react";
import { type TableField, type SelectFieldOption, type SelectFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

export function SelectCell({ field, value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const config = (field.config || {}) as SelectFieldConfig;
  const options = config.options || [];
  const [draft, setDraft] = useState<string | undefined>(typeof value === "string" ? value : undefined);

  useEffect(() => {
    setDraft(typeof value === "string" ? value : undefined);
  }, [value]);

  if (editing) {
    return (
      <select
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1"
        value={draft ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          setDraft(next ?? undefined);
          onCommit(next);
        }}
        onBlur={() => onCommit(draft ?? null)}
      >
        <option value="">Select...</option>
        {options.map((opt: SelectFieldOption) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const display = options.find((opt) => opt.id === value)?.label;

  return (
    <button
      className="w-full text-left text-sm text-[var(--foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
      onClick={onStartEdit}
      disabled={saving}
    >
      {display ?? ""}
    </button>
  );
}
