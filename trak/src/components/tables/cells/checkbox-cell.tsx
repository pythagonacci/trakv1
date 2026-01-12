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

export function CheckboxCell({ field, value, onCommit, onStartEdit, saving }: Props) {
  const checked = value === true;

  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[var(--primary)] cursor-pointer"
      checked={checked}
      onChange={(e) => {
        onStartEdit();
        onCommit(e.target.checked);
      }}
      aria-label={`${field.name} checkbox`}
      disabled={saving}
    />
  );
}
