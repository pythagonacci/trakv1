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
  const toList = (): Array<{ checked: boolean; label: string }> => {
    if (Array.isArray(value)) return value as Array<{ checked: boolean; label: string }>;
    if (typeof value === "object" && value !== null) {
      const v = value as { checked?: boolean; label?: string };
      return [{ checked: !!v.checked, label: v.label ?? "" }];
    }
    if (typeof value === "boolean") return [{ checked: value, label: "" }];
    if (typeof value === "string") return [{ checked: false, label: value }];
    return [{ checked: false, label: "" }];
  };

  const items = toList();

  const commit = (next: Array<{ checked: boolean; label: string }>) => {
    onCommit(next);
  };

  const updateItem = (idx: number, nextItem: { checked: boolean; label: string }) => {
    const next = [...items];
    next[idx] = nextItem;
    commit(next);
  };

  const addItemAfter = (idx: number) => {
    const next = [...items];
    next.splice(idx + 1, 0, { checked: false, label: "" });
    commit(next);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {items.map((item, idx) => (
        <label key={idx} className="inline-flex items-center gap-2 cursor-pointer w-full">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--primary)] cursor-pointer"
            checked={item.checked}
            onChange={(e) => updateItem(idx, { ...item, checked: e.target.checked })}
            disabled={saving}
          />
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none border border-transparent focus:border-[var(--border-strong)] rounded-[2px] px-1 py-0.5"
            placeholder="Label"
            value={item.label}
            onChange={(e) => updateItem(idx, { ...item, label: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItemAfter(idx);
              }
            }}
            disabled={saving}
          />
        </label>
      ))}
    </div>
  );
}
