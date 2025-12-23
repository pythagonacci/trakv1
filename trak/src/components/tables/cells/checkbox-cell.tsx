"use client";

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

export function CheckboxCell({ value, onCommit, saving }: Props) {
  const checked = Boolean(value);
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--primary)] cursor-pointer"
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
        disabled={saving}
      />
    </label>
  );
}
